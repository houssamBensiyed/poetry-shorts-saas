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
