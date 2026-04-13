import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { getQueue, withTimeout } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (user.role !== "ADMIN") return jsonError("Forbidden", 403);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      avatar_url: true,
      role: true,
      active: true,
      createdAt: true,
      _count: { select: { channels: true, voices: true, queueRuns: true } },
    },
  });

  let queue:
    | {
        waiting: number;
        active: number;
        failed: number;
        completed: number;
        delayed: number;
        paused: number;
      }
    | null = null;
  let queueError: string | null = null;
  try {
    const counts = await withTimeout(
      getQueue().getJobCounts(
        "waiting",
        "active",
        "failed",
        "completed",
        "delayed",
        "paused",
      ),
      2_500,
      "Redis did not respond in time",
    );
    queue = {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    };
  } catch (error) {
    queueError =
      error instanceof Error ? error.message : "Redis queue is unavailable";
  }

  return NextResponse.json({
    users: users.map((entry) => ({
      id: entry.id,
      email: entry.email,
      name: entry.name,
      avatarUrl: entry.avatar_url,
      role: entry.role,
      active: entry.active,
      createdAt: entry.createdAt,
      channelCount: entry._count.channels,
      voiceCount: entry._count.voices,
      queueRunCount: entry._count.queueRuns,
    })),
    queue,
    queueError,
    currentUserId: user.id,
  });
}
