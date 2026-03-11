import { Queue } from "bullmq";
import IORedis from "ioredis";

export const QUEUE_NAME = "voice-processing";
export const JOB_NAME = "process-queue-run";

export class QueueTimeoutError extends Error {}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new QueueTimeoutError(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const globalForQueue = globalThis as unknown as {
  queue?: Queue;
  queueConnection?: IORedis;
};

function redisUrl() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not configured");
  return url;
}

/** Connection used by BullMQ workers; retries forever while Redis is down. */
export function createRedisConnection() {
  return new IORedis(redisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 5_000,
    retryStrategy: (times) => Math.min(times * 500, 5_000),
  });
}

/** Bounded connection for producers, so API requests fail instead of hanging. */
function createProducerConnection() {
  return new IORedis(redisUrl(), {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    connectTimeout: 3_000,
    retryStrategy: (times) => Math.min(times * 500, 3_000),
  });
}

export function getQueue() {
  if (!globalForQueue.queue) {
    const connection = createProducerConnection();
    globalForQueue.queueConnection = connection;
    globalForQueue.queue = new Queue(QUEUE_NAME, { connection });
  }
  return globalForQueue.queue;
}

export async function enqueueRun(runId: string) {
  const queue = getQueue();
  return withTimeout(
    queue.add(
      JOB_NAME,
      { runId },
      {
        jobId: runId,
        attempts: 1,
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    ),
    5_000,
    "Redis did not accept the queue job in time",
  );
}
