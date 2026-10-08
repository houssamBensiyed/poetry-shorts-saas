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
