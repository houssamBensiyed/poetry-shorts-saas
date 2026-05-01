import { NextResponse } from "next/server";

import { isUuid, jsonError } from "@/lib/api";
import { channelSelect, publicChannel } from "@/lib/channels";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  fetchOrganizations,
  fetchPlatformDestinations,
  UploaderError,
} from "@/lib/uploader";

export const dynamic = "force-dynamic";

/**
 * Re-read the destinations connected to this Buffer account. Existing rows keep
 * their enabled state; newly discovered platforms start switched off so nothing
 * is published to a platform the user did not pick.
 */
export async function POST(
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
      name: true,
      buffer_access_token: true,
      buffer_organization_id: true,
      buffer_organization_name: true,
      destinations: { select: { id: true, buffer_channel_id: true } },
    },
  });
  if (!channel) return jsonError("Channel not found", 404);

  let token: string;
  try {
    token = decryptToken(channel.buffer_access_token);
  } catch {
    return jsonError(
      "The stored Buffer token cannot be decrypted. Enter it again.",
      409,
    );
  }

  try {
    let organizationId = channel.buffer_organization_id;
    let organizationName = channel.buffer_organization_name;

    if (!organizationId) {
      const organizations = await fetchOrganizations(token);
      if (organizations.length === 0) {
        return jsonError("This Buffer token has no organizations", 409);
      }
      if (organizations.length > 1) {
        return NextResponse.json(
          {
            error:
              "This Buffer token has more than one organization. Edit the channel and choose one.",
            organizations,
          },
          { status: 409 },
        );
      }
      organizationId = organizations[0].id;
      organizationName = organizations[0].name;
    }

    const remote = await fetchPlatformDestinations(token, organizationId);
    const known = new Set(channel.destinations.map((item) => item.buffer_channel_id));
    let created = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      for (const destination of remote) {
        const exists = known.has(destination.id);
        await tx.channelDestination.upsert({
          where: {
            channelId_buffer_channel_id: {
              channelId: channel.id,
              buffer_channel_id: destination.id,
            },
          },
          create: {
            channelId: channel.id,
            buffer_channel_id: destination.id,
            name: destination.displayName || destination.name,
            service: destination.service,
            avatar: destination.avatar,
            enabled: false,
            is_disconnected: destination.isDisconnected,
            is_locked: destination.isLocked,
            is_queue_paused: destination.isQueuePaused,
            last_synced_at: new Date(),
          },
          update: {
            name: destination.displayName || destination.name,
            service: destination.service,
            avatar: destination.avatar,
            is_disconnected: destination.isDisconnected,
            is_locked: destination.isLocked,
            is_queue_paused: destination.isQueuePaused,
            last_synced_at: new Date(),
          },
        });
        if (exists) updated += 1;
        else created += 1;
      }

      // Platforms removed from Buffer must stop being publishable.
      const remoteIds = new Set(remote.map((destination) => destination.id));
      const stale = channel.destinations.filter(
        (destination) => !remoteIds.has(destination.buffer_channel_id),
      );
      if (stale.length > 0) {
        await tx.channelDestination.updateMany({
          where: { id: { in: stale.map((destination) => destination.id) } },
          data: {
            enabled: false,
            is_disconnected: true,
            last_synced_at: new Date(),
          },
        });
      }

      await tx.channel.update({
        where: { id: channel.id },
        data: {
          buffer_organization_id: organizationId,
          buffer_organization_name: organizationName ?? null,
        },
      });
    });

    const refreshed = await prisma.channel.findUniqueOrThrow({
      where: { id: channel.id },
      select: channelSelect,
    });

    return NextResponse.json({
      channel: publicChannel(refreshed),
      created,
      updated,
      organization_id: organizationId,
      organization_name: organizationName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not refresh destinations";
    return jsonError(
      message,
      error instanceof UploaderError ? error.statusCode : 502,
    );
  }
}
