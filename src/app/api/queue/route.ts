import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { findActiveRun, QueueEnqueueError, QueueRunError, startQueueRun } from "@/lib/runs";
import { getSessionUser } from "@/lib/session";
import { publicVoice } from "@/lib/voices";

export const dynamic = "force-dynamic";

const runVoiceSelect = {
  id: true,
  title: true,
  status: true,
  storage_mode: true,
  rendered_video_url: true,
  buffer_post_id: true,
  error_message: true,
  upload_to_buffer: true,
  duration_seconds: true,
  scheduled_at: true,
  createdAt: true,
  channel: { select: { id: true, name: true } },
  publishes: {
    select: {
      status: true,
      error_message: true,
      destination: { select: { name: true, service: true } },
    },
  },
} as const;

function progressOf(total: number, completed: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const [activeRun, recentRuns, queuedCount] = await Promise.all([
    prisma.queueRun.findFirst({
      where: { userId: user.id, status: { in: ["processing", "rendered", "submitting"] } },
      orderBy: { createdAt: "desc" },
      include: {
        voices: { orderBy: { createdAt: "asc" }, select: runVoiceSelect },
      },
    }),
    prisma.queueRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { voices: { select: { status: true } } },
    }),
    prisma.voice.count({ where: { userId: user.id, status: "queued" } }),
  ]);
