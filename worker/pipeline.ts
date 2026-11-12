import type { Prisma } from "@prisma/client";

import { destinationReady } from "../src/lib/channels";
import { decryptToken } from "../src/lib/crypto";
import { uploadVideo } from "../src/lib/cloudinary";
import {
  cloudinaryUserSelect,
  isCloudinaryConfigured,
  resolveCloudinaryCredentials,
} from "../src/lib/cloudinary-credentials";
import { prisma } from "../src/lib/prisma";
import {
  aggregateVoiceStatus,
  recordPublishResults,
} from "../src/lib/publish-status";
import { resolveLocalFile } from "../src/lib/storage";
import { publishVoice, type RemotePublishResult } from "../src/lib/uploader";

const pipelineUserSelect = {
  active: true,
  ...cloudinaryUserSelect,
} as const;

type VoiceWithChannel = Prisma.VoiceGetPayload<{
  include: {
    channel: { include: { destinations: true } };
    user: { select: typeof pipelineUserSelect };
  };
}>;

export type PipelineLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, error?: unknown) => void;
};

const defaultLogger: PipelineLogger = {
  info: (message) => console.log(`[worker] ${message}`),
  warn: (message) => console.warn(`[worker] ${message}`),
  error: (message, error) =>
    console.error(
      `[worker] ${message}`,
      error instanceof Error ? error.message : error ?? "",
    ),
};

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const RENDER_SERVICE_URL = (
  process.env.RENDER_SERVICE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");
const WEBHOOK_BASE_URL = (
  process.env.WEBHOOK_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const POLL_INTERVAL_MS = numberFromEnv("WORKER_POLL_INTERVAL_MS", 2_000);
const RENDER_TIMEOUT_MS = numberFromEnv("RENDER_TIMEOUT_MS", 30 * 60_000);
const REQUEST_TIMEOUT_MS = numberFromEnv(
  "SERVICE_REQUEST_TIMEOUT_MS",
  30_000,
);

const RENDER_API_KEY =
  process.env.RENDER_SERVICE_API_KEY ?? process.env.VIDEO_BUILDER_API_KEY;

const FINISHED_STATUSES = [
  "scheduled",
  "publishing",
  "partial",
  "published",
  "completed",
] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(
  url: string,
  body: unknown,
  apiKey: string | undefined,
  label: string,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text().catch(() => "");
  // A 409 from the render service means this voice is already being rendered.
  // The webhook will still arrive, so waiting is safe. Other 409s are real
  // conflicts and must fail immediately instead of blocking the worker.
  if (response.status === 409) {
    const lower = text.toLowerCase();
    if (
      lower.includes("already") ||
      lower.includes("running") ||
      lower.includes("in progress")
    ) {
      return { alreadyRunning: true, text };
    }
    throw new Error(
      `${label} responded with HTTP 409: ${text.slice(0, 300) || "conflict"}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `${label} responded with HTTP ${response.status}: ${
        text.slice(0, 300) || "no response body"
      }`,
    );
  }
  return { alreadyRunning: false, text };
}

async function waitForRender(voiceId: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const voice = await prisma.voice.findUnique({
      where: { id: voiceId },
      select: {
        status: true,
        error_message: true,
        rendered_video_url: true,
      },
    });
    if (!voice) throw new Error("Voice was deleted while it was being processed");
    if (voice.status === "rendered" || voice.status === "failed") return voice;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `Timed out after ${Math.round(timeoutMs / 60_000)} minute(s) waiting for the render webhook`,
  );
}

async function markFailed(voiceId: string, message: string) {
  // Never overwrite a voice that a webhook already moved forward.
  await prisma.voice.updateMany({
    where: {
      id: voiceId,
      status: { in: ["queued", "processing", "rendered", "submitting"] },
    },
    data: { status: "failed", error_message: message.slice(0, 2000) },
  });
}

function activeDestinations(voice: VoiceWithChannel) {
  return voice.channel.destinations.filter(destinationReady);
}

/**
 * Buffer only accepts public URLs, so a local-mode reel is uploaded to
 * Cloudinary once, right before publishing. The local file stays the primary
 * copy and is still served by the SaaS.
 */
async function publishVideoUrl(
  voice: VoiceWithChannel,
  videoUrl: string,
  logger: PipelineLogger,
) {
  if (voice.storage_mode !== "LOCAL") return videoUrl;
  if (voice.buffer_video_url) return voice.buffer_video_url;

  const localFile = await resolveLocalFile(videoUrl);

  // Buffer only gets a public URL, so the reel is uploaded to the account that
  // owns this voice. Never fall back to another user's account.
  if (!isCloudinaryConfigured(voice.user)) {
    throw new Error(
      "Cloudinary is not set up for this account. Add the cloud name, API key and API secret in Profile, then retry.",
    );
  }
  const credentials = resolveCloudinaryCredentials(voice.user);
  if (!credentials) {
    throw new Error(
      "The saved Cloudinary secret cannot be read. Enter it again in Profile, then retry.",
    );
  }

  logger.info(
    `Uploading the local reel for "${voice.title}" to Cloudinary for Buffer`,
  );
  const uploaded = await uploadVideo(localFile, voice.id, credentials);
  await prisma.voice.updateMany({
    where: { id: voice.id },
    data: { buffer_video_url: uploaded },
  });
  return uploaded;
}

async function processVoice(voice: VoiceWithChannel, logger: PipelineLogger) {
  if (
    (FINISHED_STATUSES as readonly string[]).includes(voice.status) ||
    voice.status === "publishing"
  ) {
    return voice.status;
  }
  // Failed voices only re-run through the explicit retry action, which resets
  // them to queued before enqueueing a new run.
  if (voice.status === "failed") {
    return "failed" as const;
  }

  if (!voice.channel.enabled) {
    throw new Error(
      `Channel "${voice.channel.name}" is disabled. Enable it before processing.`,
    );
  }
  if (!voice.user.active) {
    throw new Error("This account is disabled and cannot process voices.");
  }

  // A worker restart can find a voice already rendered.
  // Resume from the stored video instead of rendering it twice.
  let videoUrl = voice.rendered_video_url;

  if (videoUrl) {
    logger.info(
      `Resuming "${voice.title}" (${voice.id}) from an existing render`,
    );
  } else {
    // Only an active voice can be claimed. If a webhook already moved it to
    // rendered, reuse that result instead of starting a second render.
    const claimed = await prisma.voice.updateMany({
      where: { id: voice.id, status: { in: ["queued", "processing"] } },
      data: {
        status: "processing",
        error_message: null,
        buffer_post_id: null,
      },
    });

    if (claimed.count === 0) {
      const current = await prisma.voice.findUnique({
        where: { id: voice.id },
        select: { status: true, rendered_video_url: true },
      });
      if (current?.status === "rendered" && current.rendered_video_url) {
        videoUrl = current.rendered_video_url;
      } else {
        return current?.status ?? ("failed" as const);
      }
    } else {
      logger.info(
        `Rendering "${voice.title}" (${voice.id}) for channel ${voice.channel.name}`,
      );

      await postJson(
        `${RENDER_SERVICE_URL}/api/v1/render`,
        {
          voice_id: voice.id,
          audio_url: voice.audio_url,
          // Omit for remote mode so an older render service still accepts the
          // request; the render service defaults to remote.
          ...(voice.storage_mode === "LOCAL" ? { storage_mode: "local" } : {}),
          channel_name: voice.channel.name,
          reel_style: voice.reel_style ?? voice.channel.reel_style,
          language: voice.channel.language,
          callback_url: `${WEBHOOK_BASE_URL}/api/webhooks/render-complete`,
        },
        RENDER_API_KEY,
        "Render service",
      );

      const rendered = await waitForRender(voice.id, RENDER_TIMEOUT_MS);
      if (rendered.status === "failed") {
        logger.warn(
          `Render failed for ${voice.id}: ${rendered.error_message ?? "unknown error"}`,
        );
        return "failed" as const;
      }
      videoUrl = rendered.rendered_video_url;
    }
  }

  if (!videoUrl) {
    throw new Error("Render service reported success without a video URL");
  }

  if (!voice.upload_to_buffer) {
    await prisma.voice.updateMany({
      where: { id: voice.id, status: { in: ["rendered", "processing"] } },
      data: { status: "completed" },
    });
    logger.info(`Completed "${voice.title}" (no Buffer upload requested)`);
    return "completed" as const;
  }

  if (!voice.scheduled_at) {
    throw new Error(
      `No publish date was chosen for "${voice.title}". Set the UTC date and time first.`,
    );
  }
  if (voice.scheduled_at.getTime() <= Date.now()) {
    throw new Error(
      `The publish time for "${voice.title}" has already passed. Choose a future UTC date and time, then retry.`,
    );
  }

  const destinations = activeDestinations(voice);
  if (destinations.length === 0) {
    throw new Error(
      `Channel "${voice.channel.name}" has no active Buffer destination. Enable at least one platform.`,
    );
  }

  // If this attempt already created publish rows, do not create a second set of
  // Buffer posts. Recompute the status from the stored rows instead.
  const existingPublishes = await prisma.voicePublish.findMany({
    where: { voiceId: voice.id },
    select: { status: true },
  });
  if (existingPublishes.length > 0) {
    const status = aggregateVoiceStatus(
      existingPublishes.map((publish) => publish.status),
    );
    logger.warn(
      `"${voice.title}" (${voice.id}) already has publish results; skipping a duplicate submit`,
    );
    return status ?? ("scheduled" as const);
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(voice.channel.buffer_access_token);
  } catch {
    throw new Error(
      `Could not decrypt the Buffer token for channel "${voice.channel.name}"`,
    );
  }

  const claimed = await prisma.voice.updateMany({
    where: {
      id: voice.id,
      status: { in: ["rendered", "processing", "submitting"] },
    },
    data: { status: "submitting", error_message: null },
  });
  if (claimed.count === 0) {
    throw new Error(
      `Voice "${voice.title}" is no longer in a publishable state.`,
    );
  }

  logger.info(
    `Scheduling "${voice.title}" for ${voice.scheduled_at.toISOString()} on ${
      destinations.length
    } destination(s)`,
  );

  const response = await publishVoice({
    token: accessToken,
    voiceId: voice.id,
    videoUrl: await publishVideoUrl(voice, videoUrl, logger),
    title: voice.title,
    description: voice.description,
    scheduledAt: voice.scheduled_at,
    destinations: destinations.map((destination) => ({
      buffer_channel_id: destination.buffer_channel_id,
      service: destination.service,
      youtube_category_id: destination.youtube_category_id,
    })),
    callbackUrl: `${WEBHOOK_BASE_URL}/api/webhooks/publish-complete`,
  });

  // Project 03 must return one result per requested destination. Missing
  // results are failures, otherwise a partial publish could look scheduled.
  const results: RemotePublishResult[] = [...response.results];
  const returned = new Set(
    results.map((result) => result.buffer_channel_id),
  );
  for (const destination of destinations) {
    if (!returned.has(destination.buffer_channel_id)) {
      results.push({
        buffer_channel_id: destination.buffer_channel_id,
        buffer_post_id: null,
        status: "failed",
        error: "Buffer did not return a result for this destination",
      });
    }
  }

  const status = results.length > 0
    ? await recordPublishResults(voice.id, results)
    : null;
  const failed = results.filter((result) => result.status === "failed");

  if (!status) {
    throw new Error("Buffer returned no usable publish results");
  }

  if (status === "failed" || failed.length === results.length) {
    logger.warn(
      `Every destination failed for ${voice.id}: ${
        failed[0]?.error ?? "unknown error"
      }`,
    );
    await markFailed(
      voice.id,
      failed
        .map((result) => result.error)
        .filter(Boolean)
        .join("; ")
        .slice(0, 2000) || "Buffer rejected every destination",
    );
    return "failed" as const;
  }

  if (failed.length > 0) {
    logger.warn(
      `${failed.length}/${results.length} destination(s) failed for ${voice.id}`,
    );
  }

  logger.info(
    `Scheduled "${voice.title}" (${status}) with ${results.length} destination(s)`,
  );
  return status;
}

/**
 * Process every voice in a QueueRun sequentially, updating progress after each
 * voice. Webhooks from Project 02 move voices to rendered/failed; Project 03 is
 * called directly and returns one result per destination.
 */
export async function processRun(
  runId: string,
  logger: PipelineLogger = defaultLogger,
) {
  const run = await prisma.queueRun.findUnique({ where: { id: runId } });
  if (!run) {
    logger.warn(`QueueRun ${runId} no longer exists`);
    return;
  }
  if (run.status === "completed" || run.status === "failed") return;

  const voices = await prisma.voice.findMany({
    where: { queueRunId: runId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      channel: { include: { destinations: true } },
      user: { select: pipelineUserSelect },
    },
  });

  await prisma.queueRun.update({
    where: { id: runId },
    data: {
      status: "processing",
      total_items: voices.length,
      completed_items: 0,
    },
  });

  logger.info(`Starting queue run ${runId} with ${voices.length} voice(s)`);

  let failures = 0;
  for (let index = 0; index < voices.length; index += 1) {
    const voice = voices[index];
    try {
      const result = await processVoice(voice, logger);
      if (result === "failed") failures += 1;
    } catch (error) {
      failures += 1;
      const message =
        error instanceof Error ? error.message : "Unexpected processing error";
      logger.error(`Voice ${voice.id} failed`, error);
      await markFailed(voice.id, message);
    }

    await prisma.queueRun.update({
      where: { id: runId },
      data: { completed_items: index + 1 },
    });
  }

  const allFailed = voices.length > 0 && failures === voices.length;
  await prisma.queueRun.updateMany({
    where: {
      id: runId,
      status: { in: ["processing", "rendered", "submitting"] },
    },
    data: { status: allFailed ? "failed" : "completed" },
  });

  logger.info(
    `Queue run ${runId} finished with ${voices.length - failures}/${voices.length} voice(s) processed`,
  );
}
