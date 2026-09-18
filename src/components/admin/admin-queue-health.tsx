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
