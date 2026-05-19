import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";

import { isUuid, jsonError, validationError } from "@/lib/api";
import { recordPostingTime } from "@/lib/posting-times";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { resolveLocalFile } from "@/lib/storage";
import { utcDateTime } from "@/lib/time";
import { scheduleUpdateSchema } from "@/lib/validation";

const ACTIVE_STATUSES = ["processing", "rendered", "submitting"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (!isUuid(params.id)) return jsonError("Voice not found", 404);

  const voice = await prisma.voice.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      status: true,
      scheduled_at: true,
      queueRunId: true,
      queueRun: { select: { status: true } },
      channel: { select: { language_group: true } },
    },
  });
  if (!voice) return jsonError("Voice not found", 404);
  if (
    voice.queueRun &&
    (ACTIVE_STATUSES as readonly string[]).includes(voice.queueRun.status)
  ) {
    return jsonError(
      "This voice is part of a run in progress. Wait for the run to finish before rescheduling it.",
      409,
    );
  }
  if (!["queued", "failed"].includes(voice.status)) {
    return jsonError(
      "The schedule can only change while the voice is queued or failed.",
      409,
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = scheduleUpdateSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const scheduledAt = utcDateTime(
    parsed.data.scheduled_date,
    parsed.data.scheduled_time,
  );
  if (!scheduledAt) return jsonError("The publish date or time is not valid", 422);
  if (scheduledAt.getTime() <= Date.now()) {
    return jsonError("The publish date and time must be in the future (UTC+0).", 422);
  }

  const updated = await prisma.voice.update({
    where: { id: voice.id },
    data: {
      scheduled_at: scheduledAt,
      error_message: null,
    },
    select: {
      id: true,
      status: true,
      scheduled_at: true,
    },
  });

  if (voice.status === "failed") {
    await prisma.voicePublish.updateMany({
      where: { voiceId: voice.id },
      data: { scheduled_at: scheduledAt },
    });
  }

  await recordPostingTime(
    user.id,
    voice.channel.language_group,
    Number(scheduledAt.toISOString().slice(11, 13)) * 60 +
      Number(scheduledAt.toISOString().slice(14, 16)),
  ).catch((error) => {
    console.warn("Could not record the posting time", error);
  });

  return NextResponse.json({ voice: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (!isUuid(params.id)) return jsonError("Voice not found", 404);

  const voice = await prisma.voice.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      status: true,
      storage_mode: true,
      audio_url: true,
      rendered_video_url: true,
      queueRunId: true,
      queueRun: { select: { status: true } },
      publishes: {
        where: { buffer_post_id: { not: null }, status: { not: "failed" } },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!voice) return jsonError("Voice not found", 404);

  if (
    (ACTIVE_STATUSES as readonly string[]).includes(voice.status) ||
    (voice.queueRun &&
      (ACTIVE_STATUSES as readonly string[]).includes(voice.queueRun.status))
  ) {
    return jsonError(
      "This voice is being processed. Wait for the run to finish before deleting it.",
      409,
    );
  }

  if (voice.publishes.length > 0) {
    return jsonError(
      "This voice has posts in Buffer. Remove those posts in Buffer before deleting it.",
      409,
    );
  }

  await prisma.voice.delete({ where: { id: voice.id } });

  if (voice.storage_mode === "LOCAL") {
    for (const stored of [voice.audio_url, voice.rendered_video_url]) {
      if (!stored) continue;
      try {
        await unlink(await resolveLocalFile(stored, { mustExist: false }));
      } catch {
        // Best effort: a missing file or unset LOCAL_MEDIA_ROOT must not block deletion.
      }
    }
  }

  return NextResponse.json({ ok: true });
}
