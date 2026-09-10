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
