import { NextResponse } from "next/server";

import { errorMessage, jsonError, validationError } from "@/lib/api";
import { channelSelect, publicChannel } from "@/lib/channels";
import { encryptToken } from "@/lib/crypto";
import { languageLabel, normalizeLanguageGroup } from "@/lib/language";
import { postingTimeSelect, publicPostingTime } from "@/lib/posting-times";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { channelCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const [channels, times] = await Promise.all([
    prisma.channel.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: channelSelect,
    }),
    prisma.channelPostingTime.findMany({
      where: { userId: user.id },
      orderBy: { time_minutes: "asc" },
      select: postingTimeSelect,
    }),
  ]);

  const groupMap = new Map<
    string,
    {
      language_group: string;
      label: string;
      channel_count: number;
      times: ReturnType<typeof publicPostingTime>[];
    }
  >();

  for (const channel of channels) {
    const group = channel.language_group;
    const current = groupMap.get(group) ?? {
      language_group: group,
      label: languageLabel(group),
      channel_count: 0,
      times: [],
    };
    current.channel_count += 1;
    groupMap.set(group, current);
  }

  for (const time of times) {
    const group = groupMap.get(time.language_group);
    if (!group) {
      groupMap.set(time.language_group, {
        language_group: time.language_group,
        label: languageLabel(time.language_group),
        channel_count: 0,
        times: [publicPostingTime(time)],
      });
      continue;
    }
    group.times.push(publicPostingTime(time));
  }

  const groups = [...groupMap.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );

  return NextResponse.json({
    channels: channels.map(publicChannel),
    groups,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  try {
    const body = await request.json().catch(() => null);
    const parsed = channelCreateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const destinations = [
      ...new Map(
        parsed.data.destinations
          .filter((destination) => destination.enabled)
          .map((destination) => [destination.buffer_channel_id, destination]),
      ).values(),
    ];
    if (destinations.length === 0) {
      return jsonError("Select at least one Buffer destination", 422);
    }

    const channel = await prisma.channel.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        language: parsed.data.language,
        language_group: normalizeLanguageGroup(parsed.data.language),
        reel_style: parsed.data.reel_style,
        aspect_ratio: parsed.data.aspect_ratio,
        enabled: parsed.data.enabled,
        buffer_organization_id: parsed.data.buffer_organization_id ?? null,
        buffer_organization_name: parsed.data.buffer_organization_name ?? null,
        buffer_access_token: encryptToken(parsed.data.buffer_access_token),
        destinations: {
          create: destinations.map((destination) => ({
            buffer_channel_id: destination.buffer_channel_id,
            name: destination.name,
            service: destination.service,
            avatar: destination.avatar ?? null,
            youtube_category_id: destination.youtube_category_id ?? null,
            enabled: true,
            last_synced_at: new Date(),
          })),
        },
      },
      select: channelSelect,
    });

    return NextResponse.json(
      { channel: publicChannel(channel) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Could not create channel", error);
    return jsonError(errorMessage(error), 500);
  }
}
