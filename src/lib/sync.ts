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
