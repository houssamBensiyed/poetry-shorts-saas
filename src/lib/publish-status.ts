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

  const next = aggregateVoiceStatus(
    voice.publishes.map((item) => item.status),
  );
  if (!next) return null;
  // Never move a voice backwards from a finished state.
  if (voice.status === "published" && next !== "published") return voice.status;

  const failures = voice.publishes
    .filter((item) => item.status === "failed" && item.error_message)
    .map((item) => item.error_message as string);
  const failedCount = voice.publishes.filter(
    (item) => item.status === "failed",
  ).length;
  const postId =
    voice.publishes.find((item) => item.buffer_post_id)?.buffer_post_id ?? null;

  const errorMessage =
    next === "failed"
      ? failures[0] ?? "Buffer could not publish this voice"
      : next === "partial"
        ? `${failedCount} of ${voice.publishes.length} destinations failed${
            failures[0] ? `: ${failures[0]}` : ""
          }`
        : null;

  await tx.voice.update({
    where: { id: voice.id },
    data: {
      status: next,
      buffer_post_id: postId,
      error_message: errorMessage,
      last_synced_at: new Date(),
    },
  });

  return next;
}

/**
 * Store results for one voice, one row per destination, then recalculate the
 * voice status.
 *
 * The worker stores the HTTP response and Project 03 also sends a callback, so
 * both can arrive at the same moment. A Postgres advisory lock serializes the
 * read/merge/write for one voice across both processes. Each destination is a
 * single row, so replaying the same results is safe.
 */
export async function applyDestinationOutcomes(
  voiceId: string,
  outcomes: DestinationOutcome[],
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${voiceId}))`;

    const voice = await tx.voice.findUnique({
      where: { id: voiceId },
      select: { id: true, scheduled_at: true },
    });
    if (!voice) return null;

    for (const outcome of outcomes) {
      const existing = await tx.voicePublish.findUnique({
        where: {
          voiceId_destinationId: {
            voiceId,
            destinationId: outcome.destinationId,
          },
        },
      });

      const scheduledAt =
        outcome.scheduledAt ?? voice.scheduled_at ?? new Date();

      if (!existing) {
        await tx.voicePublish.create({
          data: {
            voiceId,
            destinationId: outcome.destinationId,
            status: outcome.status,
            buffer_post_id: outcome.bufferPostId ?? null,
            error_message:
              outcome.status === "failed" ? outcome.error ?? null : null,
            scheduled_at: scheduledAt,
            published_at: outcome.publishedAt ?? null,
            external_url: outcome.externalUrl ?? null,
            last_synced_at: outcome.syncedAt ?? new Date(),
          },
        });
        continue;
      }
