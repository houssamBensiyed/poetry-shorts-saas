import { decryptToken } from "@/lib/crypto";
import { applyDestinationOutcomes } from "@/lib/publish-status";
import { prisma } from "@/lib/prisma";
import { fetchPostStatuses } from "@/lib/uploader";

export type SyncSummary = {
  checked: number;
  updated: number;
  skipped: number;
  errors: string[];
  checkedAt: string;
};

/**
 * Ask Project 03 for the current Buffer status of posts that are due or still
 * publishing. `force` also checks posts scheduled for the future.
 *
 * If Project 03 or Buffer is unreachable, the last known status is kept and the
 * error is returned to the caller. Nothing is marked failed by a network error.
 */
export async function syncPublishStatuses(options: {
  userId?: string;
  force?: boolean;
} = {}): Promise<SyncSummary> {
  const now = new Date();
  const voices = await prisma.voice.findMany({
    where: {
      ...(options.userId ? { userId: options.userId } : {}),
      // `submitting` is included so a voice whose worker died after Buffer
      // created the posts can still be reconciled by a normal status refresh.
      status: { in: ["submitting", "scheduled", "publishing", "partial"] },
      publishes: {
        some: {
          buffer_post_id: { not: null },
          status: { in: ["scheduled", "publishing"] },
        },
      },
    },
    orderBy: { scheduled_at: "asc" },
    take: 300,
    select: {
      id: true,
      status: true,
      scheduled_at: true,
      channelId: true,
      channel: {
        select: {
          id: true,
          name: true,
          buffer_access_token: true,
        },
      },
      publishes: {
        where: { buffer_post_id: { not: null } },
        select: {
          destinationId: true,
          buffer_post_id: true,
          status: true,
        },
      },
    },
  });

  type VoiceRow = (typeof voices)[number];
  const groups = new Map<
    string,
    { name: string; token: string; voices: VoiceRow[] }
  >();
  let skipped = 0;

  for (const voice of voices) {
    const isDue =
      voice.status === "publishing" ||
      voice.status === "partial" ||
      !voice.scheduled_at ||
      voice.scheduled_at.getTime() <= now.getTime();

    if (!options.force && !isDue) {
      skipped += 1;
      continue;
    }

    const group = groups.get(voice.channelId) ?? {
      name: voice.channel.name,
      token: voice.channel.buffer_access_token,
      voices: [],
    };
    group.voices.push(voice);
    groups.set(voice.channelId, group);
  }

  let checked = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const group of groups.values()) {
    let token: string;
    try {
      token = decryptToken(group.token);
    } catch {
      errors.push(`Channel "${group.name}": stored token cannot be decrypted`);
      continue;
    }

    const postIds = [
      ...new Set(
        group.voices.flatMap((voice) =>
          voice.publishes
            .map((publish) => publish.buffer_post_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    if (postIds.length === 0) continue;

    let statuses;
    try {
      // Project 03 caps `buffer_post_ids` at 50 per request.
      statuses = [];
      for (let index = 0; index < postIds.length; index += 50) {
        const batch = await fetchPostStatuses(
          token,
          postIds.slice(index, index + 50),
        );
        statuses.push(...batch);
      }
    } catch (error) {
      errors.push(
        `Channel "${group.name}": ${
          error instanceof Error ? error.message : "status request failed"
        }`,
      );
      continue;
    }

    const byPostId = new Map(
      statuses.map((status) => [status.buffer_post_id, status]),
    );

    for (const voice of group.voices) {
      checked += voice.publishes.length;
      const outcomes = voice.publishes.flatMap((publish) => {
        if (!publish.buffer_post_id) return [];
        const remote = byPostId.get(publish.buffer_post_id);
        if (!remote) return [];
        // A status-read error is reported but never saved as a failure.
        if (remote.status == null) {
          if (remote.error) {
            errors.push(
              `Voice ${voice.id} (${publish.buffer_post_id}): ${remote.error}`,
            );
          }
          return [];
        }
        return [
          {
            destinationId: publish.destinationId,
            status: remote.status,
            bufferPostId: publish.buffer_post_id,
            error: remote.error ?? null,
            scheduledAt: voice.scheduled_at ?? undefined,
            publishedAt: remote.published_at
              ? new Date(remote.published_at)
              : null,
            externalUrl: remote.external_url ?? null,
            syncedAt: new Date(),
          },
        ];
      });

      if (outcomes.length === 0) continue;
      try {
        await applyDestinationOutcomes(voice.id, outcomes);
        updated += 1;
      } catch (error) {
        errors.push(
          `Voice ${voice.id}: ${
            error instanceof Error ? error.message : "could not save status"
          }`,
        );
      }
    }
  }

  return {
    checked,
    updated,
    skipped,
    errors,
    checkedAt: new Date().toISOString(),
  };
}
