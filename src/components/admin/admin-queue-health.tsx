"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Loader2,
  PauseCircle,
  RefreshCw,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, errorText } from "@/lib/client";

type QueueCounts = {
  waiting: number;
  active: number;
  failed: number;
  completed: number;
  delayed: number;
  paused: number;
};

type AdminPayload = {
  queue: QueueCounts | null;
  queueError: string | null;
};

export function AdminQueueHealth() {
  const [queue, setQueue] = useState<QueueCounts | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<AdminPayload>("/api/admin");
      setQueue(data.queue);
      setQueueError(data.queueError);
      setError(null);
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
      await load();
      if (!cancelled) timer = window.setTimeout(poll, 4000);
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [load]);

  const cards = [
    {
      label: "Waiting",
      value: queue?.waiting ?? 0,
      hint: "jobs queued for the worker",
      icon: Clock,
    },
    {
      label: "Active",
      value: queue?.active ?? 0,
      hint: "currently being processed",
      icon: Activity,
    },
    {
      label: "Failed",
      value: queue?.failed ?? 0,
      hint: "jobs that exhausted retries",
      icon: XCircle,
    },
    {
      label: "Completed",
      value: queue?.completed ?? 0,
      hint: "recently finished jobs",
      icon: CheckCircle2,
    },
  ];

  const total = queue
    ? queue.waiting + queue.active + queue.failed + queue.completed + queue.delayed + queue.paused
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Queue health</h1>
          <p className="page-lede">
            Global BullMQ counts for the voice-processing queue. Refreshes every
            few seconds.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3.5 text-[13px] font-medium transition-colors hover:bg-surface"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {queueError ? (
        <Alert tone="error">
          Redis is unreachable: {queueError}. Start Redis and the worker, then
          refresh.
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] font-medium text-muted-foreground">
                    {card.label}
                  </p>
                  <Icon
                    className="h-4 w-4 text-muted-foreground/60"
                    strokeWidth={1.8}
                  />
                </div>
                <p className="tabular mt-2 text-[28px] font-semibold leading-none tracking-[-0.03em]">
                  {loading ? "…" : card.value}
                </p>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  {card.hint}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Queue details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border text-[13px] sm:grid-cols-3">
            <div className="bg-card p-4">
              <p className="flex items-center gap-2 font-medium">
                <PauseCircle className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                Delayed
              </p>
              <p className="tabular mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]">
                {queue?.delayed ?? 0}
              </p>
            </div>
            <div className="bg-card p-4">
              <p className="flex items-center gap-2 font-medium">
                <PauseCircle className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                Paused
              </p>
              <p className="tabular mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]">
                {queue?.paused ?? 0}
              </p>
            </div>
            <div className="bg-card p-4">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                Total known
              </p>
              <p className="tabular mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]">
                {total}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="meta">
        Completed and failed jobs are retained for the latest 200 runs. The worker
        processes one queue run at a time (concurrency 1).
      </p>
    </div>
  );
}
