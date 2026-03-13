import type { Prisma, PublishStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { JobStatusValue } from "@/lib/types";
import type { RemotePublishResult } from "@/lib/uploader";

export type DestinationOutcome = {
  destinationId: string;
  status: PublishStatus;
  bufferPostId?: string | null;
  error?: string | null;
  scheduledAt?: Date;
  publishedAt?: Date | null;
  externalUrl?: string | null;
  syncedAt?: Date | null;
};

/**
 * Statuses only move forward. A late webhook never turns a published post back
 * into a scheduled one, and a failed post stays failed.
 */
export function mergePublishStatus(
  current: PublishStatus,
  next: PublishStatus,
): PublishStatus {
  if (current === "published" || next === "published") return "published";
  if (current === "failed" || next === "failed") return "failed";
  if (current === "publishing" || next === "publishing") return "publishing";
  return "scheduled";
}

/** The voice status is calculated from all of its destinations. */
export function aggregateVoiceStatus(
  statuses: PublishStatus[],
): JobStatusValue | null {
  if (statuses.length === 0) return null;

  const total = statuses.length;
  const failed = statuses.filter((status) => status === "failed").length;
  const published = statuses.filter((status) => status === "published").length;
  const publishing = statuses.filter((status) => status === "publishing").length;

  if (failed === total) return "failed";
  if (published === total) return "published";
  // Any destination that failed while others are still pending or succeeded
  // means the voice only published partially. This must be checked before the
  // in-progress branch, otherwise failed + scheduled reports "publishing".
  if (failed > 0) return "partial";
  if (publishing > 0) return "publishing";
  if (published > 0) return "publishing";
  return "scheduled";
}

/**
 * Recalculate one voice from its publish rows inside an existing transaction.
 * The caller holds the per-voice advisory lock, so two processes cannot write a
 * stale aggregate over a newer one.
 */
async function syncVoiceStatusTx(
  tx: Prisma.TransactionClient,
  voiceId: string,
) {
  const voice = await tx.voice.findUnique({
    where: { id: voiceId },
    select: {
      id: true,
      status: true,
      publishes: {
        select: {
          status: true,
          error_message: true,
          buffer_post_id: true,
        },
      },
    },
  });
  if (!voice || voice.publishes.length === 0) return null;
  // A retried or download-only voice keeps its pipeline status.
  if (voice.status === "completed" || voice.status === "queued") return null;
