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
