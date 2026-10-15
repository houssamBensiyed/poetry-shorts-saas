import Link from "next/link";
import {
  ArrowUpRight,
  AudioLines,
  CalendarClock,
  ListChecks,
  Radio,
  Send,
  TriangleAlert,
  Upload,
} from "lucide-react";

import { ActivityChart, type ActivityDay } from "@/components/dashboard/activity-chart";
import { PlatformMix } from "@/components/dashboard/platform-mix";
import { StatusDonut } from "@/components/dashboard/status-donut";
import { PlatformIcon } from "@/components/channels/platform-icon";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { displayName } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatUtcDateTime } from "@/lib/time";
import { cn, formatDate, truncate } from "@/lib/utils";
import { serviceLabel } from "@/lib/youtube";

export const dynamic = "force-dynamic";

const DAY_COUNT = 14;

function startOfUtcDay(offsetDays: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const activityStart = startOfUtcDay(DAY_COUNT - 1);
  const monthStart = startOfUtcDay(0);
  monthStart.setUTCDate(1);

  const [
    record,
    channelCount,
    destinationCount,
    grouped,
    activeRun,
    recentVoices,
    activityVoices,
    activityPublishes,
    publishedThisMonth,
    upcoming,
    destinationRows,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, avatar_url: true },
    }),
    prisma.channel.count({ where: { userId: user.id } }),
    prisma.channelDestination.count({ where: { channel: { userId: user.id } } }),
    prisma.voice.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
    prisma.queueRun.findFirst({
      where: {
        userId: user.id,
        status: { in: ["processing", "rendered", "submitting"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        voices: {
          include: { channel: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.voice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { channel: { select: { name: true } } },
    }),
    prisma.voice.findMany({
      where: { userId: user.id, createdAt: { gte: activityStart } },
      select: { createdAt: true },
    }),
    prisma.voicePublish.findMany({
      where: {
        voice: { userId: user.id },
        published_at: { gte: activityStart },
      },
      select: { published_at: true },
    }),
    prisma.voicePublish.count({
      where: {
        voice: { userId: user.id },
        published_at: { gte: monthStart },
      },
    }),
    prisma.voicePublish.findMany({
      where: {
        voice: { userId: user.id },
        status: { in: ["scheduled", "publishing"] },
        scheduled_at: { gte: new Date() },
      },
      orderBy: { scheduled_at: "asc" },
      take: 5,
      include: {
        destination: { select: { service: true, name: true } },
        voice: { select: { title: true } },
      },
    }),
    prisma.channelDestination.findMany({
      where: { channel: { userId: user.id } },
      select: { service: true, _count: { select: { publishes: true } } },
    }),
  ]);

  const counts = Object.fromEntries(
    grouped.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;

  const queued = counts.queued ?? 0;
  const inFlight =
    (counts.processing ?? 0) + (counts.rendered ?? 0) + (counts.submitting ?? 0);
  const published = (counts.published ?? 0) + (counts.completed ?? 0);
  const scheduled = (counts.scheduled ?? 0) + (counts.publishing ?? 0);
  const failed = (counts.failed ?? 0) + (counts.partial ?? 0);
  const totalVoices = grouped.reduce((sum, row) => sum + row._count._all, 0);

  const stats = [
    {
      label: "Channels",
      value: channelCount,
      hint: `${destinationCount} connected destination${destinationCount === 1 ? "" : "s"}`,
      icon: Radio,
      href: "/dashboard/channels",
    },
    {
      label: "Queued",
      value: queued,
      hint: queued > 0 ? "ready for the next run" : "nothing waiting",
      icon: AudioLines,
      href: "/dashboard/voices",
    },
    {
      label: "Published",
      value: published,
      hint: `${publishedThisMonth} post${publishedThisMonth === 1 ? "" : "s"} this month`,
      icon: Send,
      href: "/dashboard/voices",
    },
    {
      label: "Needs attention",
      value: failed,
      hint: failed > 0 ? "open voices to retry" : "no failures",
      icon: TriangleAlert,
      href: "/dashboard/voices",
    },
  ];

  const activityCounts = new Map<string, { voices: number; published: number }>();
  for (let index = 0; index < DAY_COUNT; index += 1) {
    activityCounts.set(startOfUtcDay(DAY_COUNT - 1 - index).toISOString().slice(0, 10), {
      voices: 0,
      published: 0,
    });
  }
  for (const voice of activityVoices) {
    const key = voice.createdAt.toISOString().slice(0, 10);
    const bucket = activityCounts.get(key);
    if (bucket) bucket.voices += 1;
  }
  for (const publish of activityPublishes) {
    if (!publish.published_at) continue;
    const key = publish.published_at.toISOString().slice(0, 10);
    const bucket = activityCounts.get(key);
    if (bucket) bucket.published += 1;
  }
  const activityDays: ActivityDay[] = Array.from(activityCounts.entries()).map(
    ([key, value]) => {
      const date = new Date(`${key}T00:00:00.000Z`);
      return {
        key,
        short: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        full: date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        ...value,
      };
    },
  );

  const statusSlices = [
    { label: "Published", value: published, color: "hsl(var(--chart-2))" },
    { label: "Scheduled", value: scheduled, color: "hsl(var(--chart-1))" },
    { label: "In flight", value: inFlight, color: "hsl(var(--chart-3))" },
    { label: "Queued", value: queued, color: "hsl(var(--chart-4))" },
    { label: "Failed", value: failed, color: "hsl(var(--chart-5))" },
  ];

  const platformCounts = new Map<string, number>();
  for (const row of destinationRows) {
    if (row._count.publishes === 0) continue;
    platformCounts.set(
      row.service,
      (platformCounts.get(row.service) ?? 0) + row._count.publishes,
    );
  }
  const platforms = Array.from(platformCounts.entries())
    .map(([service, count]) => ({
      service,
      label: serviceLabel(service),
      count,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);

  const progress = activeRun
    ? activeRun.total_items > 0
      ? Math.round((activeRun.completed_items / activeRun.total_items) * 100)
      : 0
    : 0;
  const currentVoice = activeRun?.voices.find((voice) =>
    ["processing", "submitting"].includes(voice.status),
  );

  const name = displayName(record?.name, user.email);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Welcome back, {name}</h1>
          <p className="page-lede">
            {totalVoices > 0
              ? `${totalVoices} recording${totalVoices === 1 ? "" : "s"} across ${channelCount} channel${channelCount === 1 ? "" : "s"}. Here is how the last two weeks look.`
              : "Create a channel, upload a voice, then start your first queue run."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/channels" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Manage channels
          </Link>
          <Link href="/dashboard/voices" className={buttonVariants({ size: "sm" })}>
            <Upload className="h-3.5 w-3.5" />
            Upload voice
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className="group bg-card p-5 transition-colors hover:bg-surface"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <Icon
                    className="h-4 w-4 text-muted-foreground/60"
                    strokeWidth={1.8}
                  />
                </div>
                <p className="tabular mt-2 text-[28px] font-semibold leading-none tracking-[-0.03em]">
                  {stat.value}
                </p>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  {stat.hint}
                </p>
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Activity</CardTitle>
            <p className="meta">
              Voices added and posts published over the last {DAY_COUNT} days.
            </p>
          </CardHeader>
          <CardContent>
            <ActivityChart days={activityDays} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Voice status</CardTitle>
            <p className="meta">Current state of every voice you own.</p>
          </CardHeader>
          <CardContent>
            <StatusDonut
              slices={statusSlices}
              total={totalVoices}
              label="Voice status"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
            <div>
              <CardTitle>Queue run</CardTitle>
              <p className="meta mt-0.5">
                {activeRun
                  ? "Voices are processed sequentially across every channel."
                  : "No run is active right now."}
              </p>
            </div>
            <Link
              href="/dashboard/queue"
              className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-medium text-link hover:underline hover:underline-offset-2"
            >
              Open queue
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeRun ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium">
                      Voice{" "}
                      {Math.min(
                        activeRun.completed_items + 1,
                        activeRun.total_items,
                      )}{" "}
                      of {activeRun.total_items}
                    </span>
                    <span className="tabular text-muted-foreground">
                      {progress}%
                    </span>
                  </div>
                  <Progress value={progress} />
                  <p className="meta">
                    {activeRun.completed_items} finished ·{" "}
                    {activeRun.total_items} total
                  </p>
                </div>
                {currentVoice ? (
                  <div className="rounded-lg border border-border bg-surface p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">
                          {truncate(currentVoice.title, 60)}
                        </p>
                        <p className="meta">{currentVoice.channel.name}</p>
                      </div>
                      <StatusBadge status={currentVoice.status} />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-dashed border-border p-4">
                <div>
                  <p className="text-[13px] font-medium">
                    {queued > 0
                      ? `${queued} voice${queued === 1 ? "" : "s"} ready to process`
                      : "Nothing queued yet"}
                  </p>
                  <p className="meta mt-0.5">
                    {queued > 0
                      ? "Open the queue to start a run."
                      : "Upload a voice first, then process it from the queue."}
                  </p>
                </div>
                <Link
                  href={queued > 0 ? "/dashboard/queue" : "/dashboard/voices"}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  {queued > 0 ? "Process voices" : "Upload a voice"}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Platform mix</CardTitle>
            <p className="meta">Where your posts are scheduled.</p>
          </CardHeader>
          <CardContent>
            <PlatformMix items={platforms} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Next to publish</CardTitle>
            <p className="meta">The next posts Buffer will release.</p>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4">
                <p className="text-[13px] font-medium">Nothing scheduled</p>
                <p className="meta mt-0.5">
                  Schedule a voice and it will appear here with its platform.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {upcoming.map((publish) => (
                  <li
                    key={`${publish.voiceId}-${publish.destinationId}`}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                        <PlatformIcon service={publish.destination.service} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">
                          {publish.voice.title}
                        </p>
                        <p className="meta mt-0.5">
                          {serviceLabel(publish.destination.service)} ·{" "}
                          {formatUtcDateTime(publish.scheduled_at)}
                        </p>
                      </div>
                    </div>
                    <BadgeSchedule />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 pb-3">
            <div>
              <CardTitle>Recent voices</CardTitle>
              <p className="meta mt-0.5">The latest recordings you added.</p>
            </div>
            <Link
              href="/dashboard/voices"
              className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-medium text-link hover:underline hover:underline-offset-2"
            >
              View all
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentVoices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4">
                <p className="meta">
                  No voices uploaded yet.{" "}
                  <Link
                    href="/dashboard/voices"
                    className="font-medium text-link hover:underline hover:underline-offset-2"
                  >
                    Add your first recording
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {recentVoices.map((voice) => (
                  <div
                    key={voice.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {voice.title}
                      </p>
                      <p className="meta mt-0.5">
                        {voice.channel.name} · {formatDate(voice.createdAt)}
                      </p>
                      {voice.scheduled_at ? (
                        <p className="meta">
                          Publishes {formatUtcDateTime(voice.scheduled_at)}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge status={voice.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {channelCount === 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <ListChecks className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-medium">Start with a channel</p>
                <p className="meta mt-0.5">
                  Connect a Buffer token and pick at least one platform. Then
                  upload a voice.
                </p>
              </div>
            </div>
            <Link href="/dashboard/channels" className={buttonVariants({ size: "sm" })}>
              Add a channel
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function BadgeSchedule() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-300">
      <CalendarClock className="h-3 w-3" />
      Scheduled
    </span>
  );
}
