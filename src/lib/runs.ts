import { prisma } from "@/lib/prisma";
import { enqueueRun, getQueue } from "@/lib/queue";
import type { JobStatusValue } from "@/lib/types";

/** QueueRun statuses that mean work is still in flight. */
export const RUN_ACTIVE_STATUSES: JobStatusValue[] = [
  "processing",
  "rendered",
  "submitting",
];

export class QueueRunError extends Error {}
export class QueueEnqueueError extends QueueRunError {}

export async function findActiveRun(userId: string) {
  return prisma.queueRun.findFirst({
    where: { userId, status: { in: RUN_ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, total_items: true, completed_items: true },
  });
}

/**
 * Create a QueueRun over the given voices (or every queued voice for the user),
 * enqueue its BullMQ job, and return the run. Only one active run per user is
 * allowed so voices are processed sequentially.
 *
 * A PostgreSQL advisory lock serialises concurrent "process" clicks for the same
 * user, so two requests cannot both claim the same queued voices.
 */
export async function startQueueRun(userId: string, voiceIds?: string[]) {
  const { run, originalVoices, originalPublishes } = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      const active = await tx.queueRun.findFirst({
        where: { userId, status: { in: RUN_ACTIVE_STATUSES } },
        select: { id: true },
      });
      if (active) {
        throw new QueueRunError(
          "A queue run is already in progress. Wait for it to finish before starting another.",
        );
      }

      const voices = await tx.voice.findMany({
        where: {
          userId,
          ...(voiceIds ? { id: { in: voiceIds } } : {}),
          status: voiceIds ? { in: ["queued", "failed"] } : "queued",
          channel: { enabled: true },
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      if (voices.length === 0) {
        throw new QueueRunError(
          voiceIds
            ? "This voice is no longer queued. Refresh the page and try again."
            : "There are no queued voices to process.",
        );
      }

      const ids = voices.map((voice) => voice.id);

      // Capture everything the reset below overwrites, so a failed enqueue can
      // be rolled back without losing retry history.
      const originalVoices = await tx.voice.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          status: true,
          queueRunId: true,
          error_message: true,
          rendered_video_url: true,
          buffer_video_url: true,
          buffer_post_id: true,
          last_synced_at: true,
        },
      });
      const originalPublishes = await tx.voicePublish.findMany({
        where: { voiceId: { in: ids } },
      });

      const created = await tx.queueRun.create({
        data: {
          userId,
          status: "processing",
          total_items: voices.length,
          completed_items: 0,
        },
      });

      await tx.voice.updateMany({
        where: { id: { in: ids }, userId },
        data: {
          queueRunId: created.id,
          status: "queued",
          error_message: null,
          rendered_video_url: null,
          buffer_video_url: null,
          buffer_post_id: null,
          last_synced_at: null,
        },
      });

      // A retry creates new Buffer posts, so the old per-destination results
      // are removed. The chosen publish date and time are kept.
      await tx.voicePublish.deleteMany({
        where: { voiceId: { in: ids } },
      });

      return { run: created, originalVoices, originalPublishes };
    },
  );

  try {
    await enqueueRun(run.id);
  } catch (error) {
    // `withTimeout` cannot cancel queue.add; a job may still have been accepted
    // after the timeout. Remove it before rolling the database back.
    try {
      const job = await getQueue().getJob(run.id);
      if (job) await job.remove();
    } catch {
      // Redis may be unreachable, which is why enqueueing failed.
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.queueRun.deleteMany({ where: { id: run.id } });

        for (const voice of originalVoices) {
          await tx.voice.update({
            where: { id: voice.id },
            data: {
              status: voice.status,
              queueRunId: voice.queueRunId,
              error_message: voice.error_message,
              rendered_video_url: voice.rendered_video_url,
              buffer_video_url: voice.buffer_video_url,
              buffer_post_id: voice.buffer_post_id,
              last_synced_at: voice.last_synced_at,
            },
          });
        }

        if (originalPublishes.length > 0) {
          await tx.voicePublish.createMany({ data: originalPublishes });
        }
      });
    } catch (rollbackError) {
      console.error(
        "Could not fully roll back a failed queue enqueue",
        rollbackError,
      );
    }

    throw new QueueEnqueueError(
      `Could not enqueue the queue run: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  return run;
}
