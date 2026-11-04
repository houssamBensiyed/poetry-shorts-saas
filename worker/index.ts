import "dotenv/config";

import { Worker } from "bullmq";

import { prisma } from "../src/lib/prisma";
import {
  createRedisConnection,
  enqueueRun,
  getQueue,
  JOB_NAME,
  QUEUE_NAME,
} from "../src/lib/queue";
import { syncPublishStatuses } from "../src/lib/sync";
import { processRun } from "./pipeline";

const connection = createRedisConnection();
const queue = getQueue();

const worker = new Worker<{ runId: string }>(
  QUEUE_NAME,
  async (job) => {
    if (job.name !== JOB_NAME) return;
    await processRun(job.data.runId);
  },
  { connection, concurrency: 1 },
);

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} complete`);
});
worker.on("failed", (job, error) => {
  const runId = (job?.data as { runId?: string } | undefined)?.runId;
  console.error(
    `[worker] Job ${job?.id ?? "unknown"} failed:`,
    error.message,
  );
  if (!runId) return;

  // A job-level failure (Prisma error, unexpected throw) must not leave the run
  // stuck in "processing" and block every future run for the user.
  void prisma
    .$transaction([
      prisma.queueRun.updateMany({
        where: {
          id: runId,
          status: { in: ["processing", "rendered", "submitting"] },
        },
        data: { status: "failed" },
      }),
      prisma.voice.updateMany({
        where: {
          queueRunId: runId,
          status: { in: ["queued", "processing", "rendered", "submitting"] },
        },
        data: {
          status: "failed",
          error_message: `Queue job failed: ${error.message}`.slice(0, 2000),
        },
      }),
    ])
    .catch((cleanupError) => {
      console.error(
        `[worker] Could not fail queue run ${runId}:`,
        cleanupError instanceof Error ? cleanupError.message : cleanupError,
      );
    });
});
worker.on("error", (error) => {
  console.error("[worker] Worker error:", error.message);
});

async function reconcile() {
  const running = await prisma.queueRun.findMany({
    where: { status: { in: ["processing", "rendered", "submitting"] } },
    select: { id: true },
  });

  for (const run of running) {
    const existing = await queue.getJob(run.id).catch(() => null);
    if (!existing) {
      await enqueueRun(run.id);
      console.log(`[worker] Re-enqueued orphaned queue run ${run.id}`);
      continue;
    }

    // Failed/completed jobs are retained by BullMQ. The old code only checked
    // that a job existed, so a failed job kept the run stuck forever.
    const state = await existing.getState().catch(() => null);
    if (state === "failed" || state === "completed" || state === "unknown") {
      await existing.remove().catch(() => undefined);
      await enqueueRun(run.id);
      console.log(`[worker] Re-enqueued ${state ?? "orphaned"} queue run ${run.id}`);
    }
  }
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] Received ${signal}, shutting down`);
  try {
    await worker.close();
    await queue.close();
    await connection.quit();
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log(`[worker] Listening on queue "${QUEUE_NAME}"`);

reconcile().catch((error) => {
  console.warn(
    "[worker] Could not reconcile existing runs:",
    error instanceof Error ? error.message : error,
  );
});

/**
 * Keep Buffer statuses fresh while the worker runs. The voices page does the
 * same check when the user opens the app, so this is only a backup.
 */
const STATUS_SYNC_INTERVAL_MS = (() => {
  const value = Number(process.env.STATUS_SYNC_INTERVAL_MS);
  return Number.isFinite(value) && value > 0 ? value : 2 * 60_000;
})();

let syncTimer: ReturnType<typeof setTimeout> | undefined;

async function syncStatuses() {
  try {
    const summary = await syncPublishStatuses();
    if (summary.errors.length > 0) {
      console.warn(
        `[worker] Status sync finished with ${summary.errors.length} error(s): ${summary.errors[0]}`,
      );
    } else if (summary.updated > 0) {
      console.log(
        `[worker] Status sync checked ${summary.checked} post(s), updated ${summary.updated} voice(s)`,
      );
    }
  } catch (error) {
    console.warn(
      "[worker] Status sync failed:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    if (!shuttingDown) {
      syncTimer = setTimeout(() => void syncStatuses(), STATUS_SYNC_INTERVAL_MS);
    }
  }
}

setTimeout(() => void syncStatuses(), 15_000);
