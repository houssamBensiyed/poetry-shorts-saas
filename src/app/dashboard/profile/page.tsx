import Link from "next/link";
import { ArrowUpRight, Cloud, HardDrive, Radio } from "lucide-react";

import { Avatar } from "@/components/avatar";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { IdentityForm } from "@/components/profile/identity-form";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { displayName } from "@/lib/avatar";
import { isCloudinaryConfigured } from "@/lib/cloudinary-credentials";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
      storage_mode: true,
      avatar_url: true,
      cloudinary_cloud_name: true,
      cloudinary_api_key: true,
      cloudinary_api_secret: true,
      _count: { select: { channels: true, voices: true, queueRuns: true } },
    },
  });

  const [published, recentVoices, destinationCount] = await Promise.all([
    prisma.voice.count({
      where: { userId: user.id, status: { in: ["published", "completed"] } },
    }),
    prisma.voice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { channel: { select: { name: true } } },
    }),
    prisma.channelDestination.count({
      where: { channel: { userId: user.id } },
    }),
  ]);

  const cloudinaryConnected = isCloudinaryConfigured(record);
  const name = displayName(record?.name, user.email);
  const stats = [
    { label: "Channels", value: record?._count.channels ?? 0 },
    { label: "Voices", value: record?._count.voices ?? 0 },
    { label: "Published", value: published },
    { label: "Queue runs", value: record?._count.queueRuns ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          src={record?.avatar_url}
          name={name}
          email={user.email}
          className="h-14 w-14 ring-1 ring-border"
        />
        <div className="min-w-0">
          <h1 className="page-title">{name}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {user.email}
          </p>
        </div>
        <Badge
          tone={user.role === "ADMIN" ? "purple" : "neutral"}
          className="mb-1 self-end"
        >
          {user.role === "ADMIN" ? "Administrator" : "Creator"}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Profile picture</CardTitle>
            <p className="meta">
              Pick artwork or upload a photo. Everyone starts with a built-in
              picture.
            </p>
          </CardHeader>
          <CardContent>
            <AvatarEditor
              initialAvatar={record?.avatar_url ?? null}
              email={user.email}
              name={name}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Account details</CardTitle>
            <p className="meta">
              Your name appears in the header and on the dashboard.
            </p>
          </CardHeader>
          <CardContent>
            <IdentityForm
              initialName={record?.name ?? ""}
              email={user.email}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-card p-5">
              <p className="text-[12px] font-medium text-muted-foreground">
                {stat.label}
              </p>
              <p className="tabular mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em]">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
            <div>
              <CardTitle>Recent voices</CardTitle>
              <p className="meta mt-0.5">Your latest recordings and their state.</p>
            </div>
            <Link
              href="/dashboard/voices"
              className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-medium text-link hover:underline hover:underline-offset-2"
            >
              All voices
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentVoices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4">
                <p className="text-[13px] font-medium">No voices yet</p>
                <p className="meta mt-0.5">
                  Upload your first recording to start a queue run.
                </p>
                <Link
                  href="/dashboard/voices"
                  className={`${buttonVariants({ size: "sm" })} mt-3`}
                >
                  Upload a voice
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {recentVoices.map((voice) => (
                  <Link
                    key={voice.id}
                    href="/dashboard/voices"
                    className="-mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-surface"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {voice.title}
                      </p>
                      <p className="meta mt-0.5">
                        {voice.channel.name} · {formatDate(voice.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={voice.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Connected services</CardTitle>
            <p className="meta">What this account can publish with.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-[12.5px]">
            <Link
              href="/dashboard/channels"
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-surface"
            >
              <span className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-muted-foreground" />
                Buffer destinations
              </span>
              <span className="tabular font-medium">{destinationCount}</span>
            </Link>

            <Link
              href="/dashboard/settings#storage"
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-surface"
            >
              <span className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                File storage
              </span>
              <Badge tone="neutral">
                {record?.storage_mode === "LOCAL" ? "Local" : "Remote"}
              </Badge>
            </Link>

            <Link
              href="/dashboard/settings#cloudinary"
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-surface"
            >
              <span className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-muted-foreground" />
                Cloudinary
              </span>
              <Badge tone={cloudinaryConnected ? "success" : "warning"}>
                {cloudinaryConnected ? "Connected" : "Not set up"}
              </Badge>
            </Link>

            <p className="pt-1 text-[11.5px] text-muted-foreground">
              Member since{" "}
              {record ? formatDate(record.createdAt) : "Not available"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
