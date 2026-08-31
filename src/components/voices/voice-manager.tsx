"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { DestinationBadge, StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errorText } from "@/lib/client";
import { languageLabel } from "@/lib/language";
import { formatUtcDateTime, todayUtcKey } from "@/lib/time";
import {
  JOB_STATUSES,
  activeStatuses,
  statusLabel,
  type DestinationStatusValue,
  type JobStatusValue,
} from "@/lib/types";
import { downloadUrl, formatDate, formatDuration, truncate } from "@/lib/utils";

type Publish = {
  id: string;
  status: DestinationStatusValue;
  buffer_post_id: string | null;
  error_message: string | null;
  scheduled_at: string;
  published_at: string | null;
  external_url: string | null;
  last_synced_at: string | null;
  destination: {
    id: string;
    name: string;
    service: string;
    buffer_channel_id: string;
    enabled: boolean;
  };
};

type Voice = {
  id: string;
  title: string;
  description: string;
  status: JobStatusValue;
  audio_url: string;
  storage_mode: "LOCAL" | "REMOTE";
  rendered_video_url: string | null;
  upload_to_buffer: boolean;
  reel_style: "A" | "B";
  duration_seconds: number | null;
  error_message: string | null;
  buffer_post_id: string | null;
  scheduled_at: string | null;
  last_synced_at: string | null;
  createdAt: string;
  channel: {
    id: string;
    name: string;
    language: string;
    language_group: string;
    reel_style: "A" | "B";
  };
  publishes: Publish[];
};

type Channel = {
  id: string;
  name: string;
  language: string;
  language_group: string;
  language_label: string;
  reel_style: "A" | "B";
  enabled: boolean;
};

type ScheduleOptions = {
  language_group: string;
  language_label: string;
  date: string;
  suggested_time: string | null;
  all_used: boolean;
  times: Array<{
    time: string;
    minutes: number;
    used: boolean;
    passed: boolean;
    use_count: number;
  }>;
};

type SyncSummary = {
  checked: number;
  updated: number;
  errors: string[];
  checkedAt: string;
};

const filterStatuses: Array<"all" | JobStatusValue> = ["all", ...JOB_STATUSES];

function groupChannels(channels: Channel[]) {
  const map = new Map<string, Channel[]>();
  for (const channel of channels) {
    const list = map.get(channel.language_group) ?? [];
    list.push(channel);
    map.set(channel.language_group, list);
  }
  return [...map.entries()]
    .sort(([left], [right]) =>
      languageLabel(left).localeCompare(languageLabel(right)),
    )
    .map(([group, list]) => ({ group, label: languageLabel(group), channels: list }));
}

function canDelete(voice: Voice) {
  if (activeStatuses.includes(voice.status) || voice.status === "publishing") {
    return false;
  }
  return !voice.publishes.some(
    (publish) => publish.buffer_post_id && publish.status !== "failed",
  );
}

/** Local voices are streamed by the SaaS; remote voices keep their Cloudinary URL. */
function reelUrl(voice: Voice, download = false) {
  if (voice.storage_mode === "LOCAL") {
    return `/api/voices/${voice.id}/media?kind=video${
      download ? "&download=1" : ""
    }`;
  }
  const url = voice.rendered_video_url ?? "";
  return download ? downloadUrl(url) : url;
}

export function VoiceManager({
  storageMode,
}: {
  storageMode: "LOCAL" | "REMOTE";
}) {
  const router = useRouter();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const [channelFilter, setChannelFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatusValue>("all");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<ScheduleOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const optionsRequest = useRef(0);

  const [form, setForm] = useState({
    title: "",
    description: "",
    channelId: "",
    upload_to_buffer: true,
    scheduled_date: todayUtcKey(),
    scheduled_time: "",
  });

  const [preview, setPreview] = useState<Voice | null>(null);
  const [startingQueue, setStartingQueue] = useState(false);

  const loadVoices = useCallback(async (silent = false) => {
    try {
      const data = await apiFetch<{ voices: Voice[] }>("/api/voices");
      setVoices(data.voices);
      if (!silent) setError(null);
    } catch (err) {
      if (!silent) setError(errorText(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      const data = await apiFetch<{ channels: Channel[] }>("/api/channels");
      setChannels(data.channels);
      setForm((current) => ({
        ...current,
        channelId:
          current.channelId ||
          data.channels.find((channel) => channel.enabled)?.id ||
          "",
      }));
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  const syncStatuses = useCallback(
    async (force: boolean) => {
      setSyncing(true);
      try {
        const data = await apiFetch<{
          summary: SyncSummary;
          voices: Voice[];
        }>(`/api/voices/sync-statuses${force ? "?force=1" : ""}`, {
          method: "POST",
        });
        setVoices(data.voices);
        setLastSync(data.summary.checkedAt);
        if (data.summary.errors.length > 0) {
          setError(data.summary.errors[0]);
        } else {
          setError(null);
        }
      } catch (err) {
        // Project 03 may be offline. Keep the last known statuses.
        setError(
          `Could not refresh Buffer statuses. Last known statuses are shown. ${errorText(
            err,
          )}`,
        );
      } finally {
        setSyncing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      await loadChannels();
      await syncStatuses(false);
      await loadVoices();
    })();
  }, [loadChannels, loadVoices, syncStatuses]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadVoices(true);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [loadVoices]);
