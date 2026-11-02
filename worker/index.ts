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
