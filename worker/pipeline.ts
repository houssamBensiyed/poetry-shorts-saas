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
