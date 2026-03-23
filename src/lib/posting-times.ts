import { prisma } from "@/lib/prisma";
import { languageLabel, normalizeLanguageGroup } from "@/lib/language";
import { minutesToTime, timeToMinutes, utcDateKey } from "@/lib/time";

export const postingTimeSelect = {
  id: true,
  language_group: true,
  time_minutes: true,
  use_count: true,
  last_used_at: true,
  createdAt: true,
} as const;

export function publicPostingTime(time: {
  id: string;
  language_group: string;
  time_minutes: number;
  use_count: number;
  last_used_at: Date;
  createdAt?: Date;
}) {
  return {
    id: time.id,
    language_group: time.language_group,
    time_minutes: time.time_minutes,
    time: minutesToTime(time.time_minutes),
    use_count: time.use_count,
    last_used_at: time.last_used_at,
    createdAt: time.createdAt,
  };
}

/** Save a time the user chose. Times are unique per user and language group. */
export async function recordPostingTime(
  userId: string,
  group: string,
  minutes: number,
) {
  const language_group = normalizeLanguageGroup(group);

  return prisma.channelPostingTime.upsert({
    where: {
      userId_language_group_time_minutes: {
        userId,
        language_group,
        time_minutes: minutes,
      },
    },
    create: {
      userId,
      language_group,
      time_minutes: minutes,
      use_count: 1,
      last_used_at: new Date(),
    },
    update: {
      use_count: { increment: 1 },
      last_used_at: new Date(),
    },
    select: postingTimeSelect,
  });
}

export async function listPostingTimes(userId: string, group?: string) {
  const language_group = group ? normalizeLanguageGroup(group) : undefined;
  const times = await prisma.channelPostingTime.findMany({
    where: { userId, ...(language_group ? { language_group } : {}) },
    orderBy: [{ time_minutes: "asc" }],
    select: postingTimeSelect,
  });
  return times.map(publicPostingTime);
}

export type ScheduleOption = {
  time: string;
  minutes: number;
  used: boolean;
  passed: boolean;
  use_count: number;
};

/**
 * Times offered to the user for one channel and one UTC date.
 *
 * `used` is checked inside the same app channel, so two channels in the same
 * language group can still publish at the same time on the same day.
 */
export async function buildScheduleOptions(options: {
  userId: string;
  channelId: string;
  date: string;
  now?: Date;
}) {
  const channel = await prisma.channel.findFirst({
    where: { id: options.channelId, userId: options.userId },
    select: { id: true, language: true, language_group: true },
  });
  if (!channel) return null;

  const dayStart = new Date(`${options.date}T00:00:00.000Z`);
  const dayEnd = new Date(`${options.date}T23:59:59.999Z`);
  const now = options.now ?? new Date();

  const [times, voices] = await Promise.all([
    prisma.channelPostingTime.findMany({
      where: { userId: options.userId, language_group: channel.language_group },
      orderBy: { time_minutes: "asc" },
      select: postingTimeSelect,
    }),
    prisma.voice.findMany({
      where: {
        userId: options.userId,
        channelId: channel.id,
        scheduled_at: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["failed", "completed"] },
      },
      select: { scheduled_at: true },
    }),
  ]);

  const usedMinutes = new Set(
    voices
      .map((voice) =>
        voice.scheduled_at
          ? Number(voice.scheduled_at.toISOString().slice(11, 13)) * 60 +
            Number(voice.scheduled_at.toISOString().slice(14, 16))
          : null,
      )
      .filter((value): value is number => value !== null),
  );

  const options_: ScheduleOption[] = times.map((time) => {
    const at = new Date(
      `${options.date}T${minutesToTime(time.time_minutes)}:00.000Z`,
    );
    return {
      time: minutesToTime(time.time_minutes),
      minutes: time.time_minutes,
      used: usedMinutes.has(time.time_minutes),
      passed: at.getTime() <= now.getTime(),
      use_count: time.use_count,
    };
  });

  const suggested = options_.find((item) => !item.used && !item.passed) ?? null;

  return {
    channel_id: channel.id,
    language_group: channel.language_group,
    language_label: languageLabel(channel.language_group),
    date: options.date,
    timezone: "UTC",
    suggested_time: suggested?.time ?? null,
    all_used: options_.length > 0 && options_.every((item) => item.used),
    times: options_,
  };
}

/** The published date and time of a voice, formatted for the API. */
export function voiceSchedule(date: Date | null | undefined) {
  if (!date) return null;
  return {
    date: utcDateKey(date),
    time: date.toISOString().slice(11, 16),
    iso: date.toISOString(),
  };
}

export { timeToMinutes };
