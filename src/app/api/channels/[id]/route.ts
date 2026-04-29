import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";

import { errorMessage, isUuid, jsonError, validationError } from "@/lib/api";
import { channelSelect, publicChannel } from "@/lib/channels";
import { encryptToken } from "@/lib/crypto";
import { normalizeLanguageGroup } from "@/lib/language";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { resolveLocalFile } from "@/lib/storage";
import { channelUpdateSchema } from "@/lib/validation";

const ACTIVE_STATUSES = ["processing", "rendered", "submitting"] as const;

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (!isUuid(params.id)) return jsonError("Channel not found", 404);

  const current = await prisma.channel.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      buffer_access_token: true,
      destinations: { select: { id: true, buffer_channel_id: true } },
    },
  });
  if (!current) return jsonError("Channel not found", 404);

  try {
    const body = await request.json().catch(() => null);
    const parsed = channelUpdateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const {
      buffer_access_token,
      destinations,
      language,
      ...fields
    } = parsed.data;
    const token = buffer_access_token?.trim();

    const channel = await prisma.$transaction(async (tx) => {
      // Destinations are never deleted, so their publish history stays intact.
      // Unticked destinations are switched off instead.
      if (destinations) {
        const unique = new Map(
          destinations.map((destination) => [
            destination.buffer_channel_id,
            destination,
          ]),
        );
        const keep = new Set(unique.keys());

        for (const destination of unique.values()) {
          await tx.channelDestination.upsert({
            where: {
              channelId_buffer_channel_id: {
                channelId: current.id,
                buffer_channel_id: destination.buffer_channel_id,
              },
            },
            create: {
              channelId: current.id,
              buffer_channel_id: destination.buffer_channel_id,
              name: destination.name,
              service: destination.service,
              avatar: destination.avatar ?? null,
              enabled: destination.enabled,
              youtube_category_id: destination.youtube_category_id ?? null,
              last_synced_at: new Date(),
            },
            update: {
              name: destination.name,
              service: destination.service,
              avatar: destination.avatar ?? null,
              enabled: destination.enabled,
              youtube_category_id: destination.youtube_category_id ?? null,
            },
          });
        }

        const removed = current.destinations.filter(
          (destination) => !keep.has(destination.buffer_channel_id),
        );
        if (removed.length > 0) {
          await tx.channelDestination.updateMany({
            where: { id: { in: removed.map((item) => item.id) } },
            data: { enabled: false },
          });
        }
      }

      return tx.channel.update({
        where: { id: current.id },
        data: {
          ...fields,
          ...(language
            ? {
                language,
                language_group: normalizeLanguageGroup(language),
              }
            : {}),
          ...(token ? { buffer_access_token: encryptToken(token) } : {}),
        },
        select: channelSelect,
      });
    });

    return NextResponse.json({ channel: publicChannel(channel) });
  } catch (error) {
    console.error("Could not update channel", error);
    return jsonError(errorMessage(error), 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (!isUuid(params.id)) return jsonError("Channel not found", 404);

  const channel = await prisma.channel.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      voices: {
        select: {
          id: true,
          status: true,
          storage_mode: true,
          audio_url: true,
          rendered_video_url: true,
          queueRun: { select: { status: true } },
          publishes: {
            where: {
              buffer_post_id: { not: null },
              status: { not: "failed" },
            },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!channel) return jsonError("Channel not found", 404);

  if (channel.voices.some((voice) => voice.publishes.length > 0)) {
    return jsonError(
      "This channel has posts in Buffer. Remove those posts in Buffer before deleting the channel.",
      409,
    );
  }
  if (
    channel.voices.some(
      (voice) =>
        (ACTIVE_STATUSES as readonly string[]).includes(voice.status) ||
        (voice.queueRun &&
          (ACTIVE_STATUSES as readonly string[]).includes(
            voice.queueRun.status,
          )),
    )
  ) {
    return jsonError(
      "A queue run is still processing voices in this channel. Wait for it to finish before deleting the channel.",
      409,
    );
  }

  const localFiles = channel.voices.flatMap((voice) =>
    voice.storage_mode === "LOCAL"
      ? [voice.audio_url, voice.rendered_video_url].filter(
          (value): value is string => Boolean(value),
        )
      : [],
  );

  await prisma.channel.delete({ where: { id: channel.id } });

  for (const stored of localFiles) {
    try {
      await unlink(await resolveLocalFile(stored, { mustExist: false }));
    } catch {
      // Best effort: a missing file must not block the delete.
    }
  }

  return NextResponse.json({ ok: true });
}
