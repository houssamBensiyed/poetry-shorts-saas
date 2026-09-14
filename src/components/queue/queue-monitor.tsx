"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  Loader2,
  Play,
  RefreshCw,
  Timer,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { apiFetch, errorText } from "@/lib/client";
import { formatUtcDateTime } from "@/lib/time";
import type { JobStatusValue, DestinationStatusValue } from "@/lib/types";
import { downloadUrl, formatDate, formatDuration, truncate } from "@/lib/utils";

type RunVoice = {
  id: string;
  title: string;
  status: JobStatusValue;
  storage_mode: "LOCAL" | "REMOTE";
  rendered_video_url: string | null;
  buffer_post_id: string | null;
  error_message: string | null;
  upload_to_buffer: boolean;
  duration_seconds: number | null;
  scheduled_at: string | null;
  createdAt: string;
  channel: { id: string; name: string };
  publishes: Array<{
    status: DestinationStatusValue;
    error_message: string | null;
    destination: { name: string; service: string };
  }>;
};

type ActiveRun = {
  id: string;
  status: JobStatusValue;
  total_items: number;
  completed_items: number;
  progress: number;
  createdAt: string;
  currentVoice: RunVoice | null;
  voices: RunVoice[];
};

type RecentRun = {
  id: string;
  status: JobStatusValue;
  total_items: number;
  completed_items: number;
  failed_items: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

type QueueData = {
  activeRun: ActiveRun | null;
  recentRuns: RecentRun[];
  queuedCount: number;
};

function reelUrl(voice: RunVoice, download = false) {
  if (voice.storage_mode === "LOCAL") {
    return `/api/voices/${voice.id}/media?kind=video${
      download ? "&download=1" : ""
    }`;
  }
  const url = voice.rendered_video_url ?? "";
  return download ? downloadUrl(url) : url;
}

export function QueueMonitor() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [preview, setPreview] = useState<RunVoice | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await apiFetch<QueueData>("/api/queue");
      setData(next);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      if (cancelled) return;
      try {
        const next = await apiFetch<QueueData>("/api/queue");
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = window.setTimeout(poll, 3000);
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  async function startRun() {
    setActionError(null);
    setStarting(true);
    try {
      await apiFetch("/api/queue", { method: "POST" });
      await load();
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setStarting(false);
    }
  }

  const activeRun = data?.activeRun ?? null;
  const queuedCount = data?.queuedCount ?? 0;
  const currentVoice = activeRun?.currentVoice ?? null;
  const nextIndex = activeRun
    ? Math.min(activeRun.completed_items + 1, Math.max(activeRun.total_items, 1))
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Queue</h1>
          <p className="page-lede">
            One run processes every queued voice across all of your channels,
            sequentially. This page refreshes automatically.
          </p>
        </div>
        <Button
          onClick={() => void startRun()}
          disabled={starting || Boolean(activeRun) || queuedCount === 0}
          title={
            activeRun
              ? "A run is already in progress"
              : queuedCount === 0
                ? "No queued voices"
                : "Process all queued voices"
          }
        >
          {starting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Process saved voices
          {queuedCount > 0 ? (
            <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[11px]">
              {queuedCount}
            </span>
          ) : null}
        </Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-8 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading queue…
          </CardContent>
        </Card>
      ) : activeRun ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Run in progress</CardTitle>
              <p className="meta mt-0.5">
                Started {formatDate(activeRun.createdAt)} · {activeRun.total_items}{" "}
                voice(s)
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-amber-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Running
            </span>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className="font-medium">
                  Voice {nextIndex} of {activeRun.total_items}
                </span>
                <span className="tabular text-muted-foreground">
                  {activeRun.completed_items}/{activeRun.total_items} finished ·{" "}
                  {activeRun.progress}%
                </span>
              </div>
              <Progress value={activeRun.progress} />
            </div>

            {currentVoice ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">
                    {currentVoice.title}
                  </p>
                  <p className="meta">
                    {currentVoice.channel.name}
                    {currentVoice.upload_to_buffer
                      ? currentVoice.scheduled_at
                        ? ` · publishes ${formatUtcDateTime(currentVoice.scheduled_at)}`
                        : " · will publish to Buffer"
                      : " · download only"}
                  </p>
                  {currentVoice.error_message ? (
                    <p className="mt-1 text-[12px] text-rose-600">
                      {currentVoice.error_message}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Webhook pending
                  </span>
                  <StatusBadge status={currentVoice.status} />
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-[13px] text-muted-foreground">
                Moving to the next voice…
              </p>
            )}

            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground/80">
                Voices in this run
              </p>
              <div className="divide-y divide-border/70 rounded-lg border border-border/80">
                {activeRun.voices.map((voice, index) => (
                  <div
                    key={voice.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-[13px]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="tabular w-5 shrink-0 text-[11px] text-muted-foreground">
                        {index + 1}.
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{voice.title}</p>
                        <p className="meta">
                          {voice.channel.name}
                          {voice.scheduled_at
                            ? ` · ${formatUtcDateTime(voice.scheduled_at)}`
                            : ""}
                        </p>
                        {voice.publishes.length > 0 ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {voice.publishes
                              .map(
                                (publish) =>
                                  `${publish.destination.name}: ${publish.status}`,
                              )
                              .join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {voice.rendered_video_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreview(voice)}
                        >
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Button>
                      ) : null}
                      <StatusBadge status={voice.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground">
              <Timer className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[15px] font-semibold">Queue is idle</p>
              <p className="meta mx-auto mt-1 max-w-sm">
                {queuedCount > 0
                  ? `${queuedCount} queued voice${queuedCount === 1 ? "" : "s"} ready. Start a run to render and publish them in order.`
                  : "Upload a voice, then come back here to process everything at once."}
              </p>
            </div>
            <Button
              onClick={() => void startRun()}
              disabled={starting || queuedCount === 0}
            >
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Process saved voices
            </Button>
          </CardContent>
        </Card>
      )}
