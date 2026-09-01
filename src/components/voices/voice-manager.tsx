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

  useEffect(() => {
    const timer = window.setInterval(() => {
      void syncStatuses(false);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [syncStatuses]);

  useEffect(() => {
    if (!uploadOpen || !form.channelId || !form.scheduled_date) {
      setOptions(null);
      setOptionsError(null);
      return;
    }

    const request = optionsRequest.current + 1;
    optionsRequest.current = request;
    setOptionsLoading(true);
    setOptionsError(null);

    void apiFetch<ScheduleOptions>(
      `/api/voices/schedule-options?channelId=${encodeURIComponent(
        form.channelId,
      )}&date=${encodeURIComponent(form.scheduled_date)}`,
    )
      .then((data) => {
        if (optionsRequest.current !== request) return;
        setOptions(data);
        setOptionsError(null);
        setForm((current) => ({
          ...current,
          scheduled_time: data.suggested_time ?? "",
        }));
      })
      .catch((err) => {
        if (optionsRequest.current !== request) return;
        setOptions(null);
        setOptionsError(errorText(err));
      })
      .finally(() => {
        if (optionsRequest.current === request) setOptionsLoading(false);
      });
  }, [uploadOpen, form.channelId, form.scheduled_date]);

  const groupedChannels = useMemo(() => groupChannels(channels), [channels]);

  const visibleVoices = useMemo(
    () =>
      voices.filter((voice) => {
        if (channelFilter !== "all" && voice.channel.id !== channelFilter) {
          return false;
        }
        if (
          languageFilter !== "all" &&
          voice.channel.language_group !== languageFilter
        ) {
          return false;
        }
        if (statusFilter !== "all" && voice.status !== statusFilter) {
          return false;
        }
        return true;
      }),
    [voices, channelFilter, languageFilter, statusFilter],
  );

  const queuedCount = voices.filter((voice) => voice.status === "queued").length;

  const languageGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const channel of channels) {
      map.set(
        channel.language_group,
        (map.get(channel.language_group) ?? 0) + 1,
      );
    }
    return [...map.entries()].sort(([left], [right]) =>
      languageLabel(left).localeCompare(languageLabel(right)),
    );
  }, [channels]);

  function openUpload() {
    setFormError(null);
    setFile(null);
    setOptions(null);
    setForm((current) => ({
      ...current,
      title: "",
      description: "",
      upload_to_buffer: true,
      channelId:
        channels.find((channel) => channel.enabled)?.id ?? current.channelId,
      scheduled_date: todayUtcKey(),
      scheduled_time: "",
    }));
    setUploadOpen(true);
  }

  async function submitUpload(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!file) {
      setFormError("Choose an .mp3 or .wav file first.");
      return;
    }
    if (!form.channelId) {
      setFormError("Create an enabled channel before uploading a voice.");
      return;
    }
    if (form.upload_to_buffer && !form.scheduled_time) {
      setFormError("Choose a publish time. All times are UTC+0.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("title", form.title);
      body.set("description", form.description);
      body.set("channelId", form.channelId);
      body.set("storage_mode", storageMode);
      body.set("upload_to_buffer", form.upload_to_buffer ? "true" : "false");
      if (form.upload_to_buffer) {
        body.set("scheduled_date", form.scheduled_date);
        body.set("scheduled_time", form.scheduled_time);
      }

      await apiFetch<{ voice: Voice }>("/api/voices", {
        method: "POST",
        body,
      });
