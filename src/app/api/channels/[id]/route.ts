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
