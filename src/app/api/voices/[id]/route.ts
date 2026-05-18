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
