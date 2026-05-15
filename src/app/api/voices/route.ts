import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";

import { errorMessage, jsonError, validationError } from "@/lib/api";
import { destinationReady } from "@/lib/channels";
import { uploadAudio } from "@/lib/cloudinary";
import {
  cloudinaryUserSelect,
  isCloudinaryConfigured,
  resolveCloudinaryCredentials,
} from "@/lib/cloudinary-credentials";
import type { CloudinaryCredentials } from "@/lib/cloudinary";
import { normalizeLanguageGroup } from "@/lib/language";
import { recordPostingTime } from "@/lib/posting-times";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { localVoicePath } from "@/lib/storage";
import { timeToMinutes, utcDateTime } from "@/lib/time";
import { JOB_STATUSES } from "@/lib/types";
import { voiceMetadataSchema } from "@/lib/validation";
import { publicVoice, voiceInclude } from "@/lib/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

const AUDIO_TYPES = new Map<string, string>([
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/wave", "wav"],
  ["audio/vnd.wave", "wav"],
]);

function audioExtension(filename: string, mime: string) {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName === "mp3" || fromName === "wav") return fromName;
  return AUDIO_TYPES.get(mime) ?? null;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const status = searchParams.get("status");
  const languageGroup = searchParams.get("languageGroup");

  if (channelId && !z.string().uuid().safeParse(channelId).success) {
    return jsonError("Invalid channel filter", 400);
  }
  if (status && !(JOB_STATUSES as readonly string[]).includes(status)) {
    return jsonError("Invalid status filter", 400);
  }

  const voices = await prisma.voice.findMany({
    where: {
      userId: user.id,
      ...(channelId ? { channelId } : {}),
      ...(status ? { status: status as (typeof JOB_STATUSES)[number] } : {}),
      ...(languageGroup
        ? {
            channel: {
              language_group: normalizeLanguageGroup(languageGroup),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 250,
    include: voiceInclude,
  });

  return NextResponse.json({ voices: voices.map(publicVoice) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Upload must be sent as multipart form data", 400);
  }

  const parsed = voiceMetadataSchema.safeParse({
    channelId: form.get("channelId"),
    title: form.get("title"),
    description: form.get("description") ?? "",
    storage_mode: form.get("storage_mode") ?? undefined,
    upload_to_buffer: form.get("upload_to_buffer") ?? "true",
    reel_style: form.get("reel_style") ?? undefined,
    scheduled_date: form.get("scheduled_date") ?? undefined,
    scheduled_time: form.get("scheduled_time") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  let scheduledAt: Date | null = null;
  if (parsed.data.upload_to_buffer) {
    if (!parsed.data.scheduled_date || !parsed.data.scheduled_time) {
      return jsonError(
        "Choose the publish date and the UTC time before uploading.",
        422,
      );
    }
    scheduledAt = utcDateTime(
      parsed.data.scheduled_date,
      parsed.data.scheduled_time,
    );
    if (!scheduledAt) {
      return jsonError("The publish date or time is not valid", 422);
    }
    if (scheduledAt.getTime() <= Date.now()) {
      return jsonError(
        "The publish date and time must be in the future (UTC+0).",
        422,
      );
    }
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("Choose an audio file to upload", 422);
  }
  if (file.size === 0) {
    return jsonError("The selected audio file is empty", 422);
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return jsonError("Audio files must be 50 MB or smaller", 413);
  }

  const extension = audioExtension(file.name, file.type);
  if (!extension) {
    return jsonError("Only .mp3 and .wav audio files are supported", 415);
  }

  const channel = await prisma.channel.findFirst({
    where: { id: parsed.data.channelId, userId: user.id },
    select: {
      id: true,
      enabled: true,
      reel_style: true,
      language_group: true,
      destinations: {
        select: {
          id: true,
          enabled: true,
          is_disconnected: true,
          is_locked: true,
          is_queue_paused: true,
        },
      },
    },
  });
  if (!channel) return jsonError("Channel not found", 404);
  if (!channel.enabled) {
    return jsonError("This channel is disabled. Enable it before uploading.", 409);
  }
  if (
    parsed.data.upload_to_buffer &&
    !channel.destinations.some(destinationReady)
  ) {
    return jsonError(
      "This channel has no active Buffer destinations. Add one before uploading.",
      409,
    );
  }

  const storageMode = parsed.data.storage_mode ?? user.storage_mode;
