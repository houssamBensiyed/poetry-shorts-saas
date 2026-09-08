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

      setUploadOpen(false);
      setNotice(
        form.upload_to_buffer
          ? `“${form.title}” queued for ${form.scheduled_date} ${form.scheduled_time} UTC.`
          : `“${form.title}” uploaded and queued.`,
      );
      await loadVoices();
      await loadChannels();
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setUploading(false);
    }
  }

  async function retry(voice: Voice) {
    setError(null);
    try {
      await apiFetch(`/api/voices/${voice.id}/retry`, { method: "POST" });
      router.push("/dashboard/queue");
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function remove(voice: Voice) {
    if (!window.confirm(`Delete “${voice.title}”? This cannot be undone.`)) {
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/voices/${voice.id}`, { method: "DELETE" });
      setNotice(`“${voice.title}” deleted.`);
      await loadVoices();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function processVoices() {
    setError(null);
    setStartingQueue(true);
    try {
      await apiFetch("/api/queue", { method: "POST" });
      router.push("/dashboard/queue");
    } catch (err) {
      setError(errorText(err));
      setStartingQueue(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Voices</h1>
          <p className="page-lede">
            Upload a recording, choose the UTC publish date and time, then
            process. Buffer publishes later, even when the app is closed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void syncStatuses(true)}
            disabled={syncing}
            title="Check every scheduled post with Buffer now"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh statuses
          </Button>
          <Button
            variant="outline"
            onClick={() => void processVoices()}
            disabled={startingQueue || queuedCount === 0}
            title={
              queuedCount === 0
                ? "No queued voices to process"
                : "Process all queued voices"
            }
          >
            {startingQueue ? (
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
          <Button onClick={openUpload}>
            <Plus className="h-4 w-4" /> Upload voice
          </Button>
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <Card>
        <CardContent className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Language</span>
              <Select
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value)}
                className="w-40"
                aria-label="Filter by language group"
              >
                <option value="all">All languages</option>
                {languageGroups.map(([group, count]) => (
                  <option key={group} value={group}>
                    {languageLabel(group)} ({count})
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Channel</span>
              <Select
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value)}
                className="w-44"
                aria-label="Filter by channel"
              >
                <option value="all">All channels</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Status</span>
              <Select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | JobStatusValue)
                }
                className="w-44"
                aria-label="Filter by status"
              >
                {filterStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All statuses" : statusLabel[status]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-[12px] text-muted-foreground">
            {visibleVoices.length} of {voices.length} voice(s)
            {lastSync ? (
              <span className="block text-[11px]">
                Buffer checked {formatDate(lastSync)}
              </span>
            ) : null}
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-8 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading voices…
          </CardContent>
        </Card>
      ) : visibleVoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground">
              <UploadCloud className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[15px] font-semibold">
                {voices.length === 0
                  ? "No voices yet"
                  : "No voices match these filters"}
              </p>
              <p className="meta mx-auto mt-1 max-w-sm">
                {voices.length === 0
                  ? "Upload an .mp3 or .wav recording, choose a UTC time, and process it."
                  : "Try a different language, channel, or status filter."}
              </p>
            </div>
            {voices.length === 0 ? (
              <Button onClick={openUpload}>
                <Plus className="h-4 w-4" /> Upload your first voice
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto ">
            <table className="data-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Voice</th>
                  <th>Channel</th>
                  <th>Publish (UTC)</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleVoices.map((voice) => (
                  <tr key={voice.id}>
                    <td className="max-w-72">
                      <p className="truncate font-medium">{voice.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {voice.description || "No description"}
                      </p>
                      {voice.error_message ? (
                        <p className="mt-1 line-clamp-2 text-xs text-rose-600">
                          {voice.error_message}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p>{voice.channel.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {languageLabel(voice.channel.language_group)} (
                        {voice.channel.language}) · Style{" "}
                        {voice.reel_style}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {voice.scheduled_at ? (
                        <>
                          <p className="font-medium">
                            {formatUtcDateTime(voice.scheduled_at)}
                          </p>
                          <p className="text-muted-foreground">
                            Created {formatDate(voice.createdAt)}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Not scheduled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={voice.status} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {voice.upload_to_buffer ? "Buffer" : "Download only"} ·{" "}
                        {voice.storage_mode === "LOCAL"
                          ? "Local files"
                          : "Cloudinary"}
                      </p>
                      {voice.publishes.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {voice.publishes.map((publish) => (
                            <li
                              key={publish.id}
                              className="flex flex-wrap items-center gap-1.5 text-xs"
                            >
                              <span className="max-w-40 truncate">
                                {publish.destination.name}
                              </span>
                              <DestinationBadge status={publish.status} />
                              {publish.external_url ? (
                                <a
                                  href={publish.external_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-link underline-offset-2 hover:underline"
                                >
                                  open
                                </a>
                              ) : null}
                              {publish.status === "failed" &&
                              publish.error_message ? (
                                <span
                                  className="max-w-56 truncate text-rose-600"
                                  title={publish.error_message}
                                >
                                  {publish.error_message}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDuration(voice.duration_seconds)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {voice.rendered_video_url ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Preview reel"
                            onClick={() => setPreview(voice)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {voice.status === "failed" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Retry voice"
                            onClick={() => void retry(voice)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canDelete(voice) ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete voice"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => void remove(voice)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="meta">
        A voice with Buffer posts cannot be deleted here. Remove the posts in
        Buffer first. Retry only failed voices.
      </p>

      <Modal
        open={uploadOpen}
        onClose={() => {
          if (!uploading) setUploadOpen(false);
        }}
        title="Upload a voice"
        description="Choose the date and time first. The time is always UTC+0."
      >
        <form onSubmit={submitUpload} className="space-y-4">
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <div className="space-y-2">
            <Label htmlFor="voice-title">Title</Label>
            <Input
              id="voice-title"
              required
              maxLength={500}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Daily Poetry #1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-description">Description</Label>
            <Textarea
              id="voice-description"
              maxLength={5000}
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Full caption #poetry #shorts"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-channel">Channel</Label>
            <Select
              id="voice-channel"
              required
              value={form.channelId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  channelId: event.target.value,
                }))
              }
            >
              <option value="" disabled>
                Choose a channel
              </option>
              {groupedChannels.map((group) => (
                <optgroup key={group.group} label={group.label}>
                  {group.channels
                    .filter((channel) => channel.enabled)
                    .map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name} · Style {channel.reel_style}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
            {channels.filter((channel) => channel.enabled).length === 0 ? (
              <p className="text-xs text-rose-600">
                No enabled channels. Create or enable one first.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5 rounded-lg border border-border bg-surface px-3.5 py-3 text-[13px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">File storage</span>
              <span className="font-medium">
                {storageMode === "LOCAL"
                  ? "Local folder on this server"
                  : "Cloudinary"}
              </span>
            </div>
            {storageMode === "LOCAL" ? (
              <p className="text-[12px] text-muted-foreground">
                Audio and reel stay local. If this voice publishes to Buffer,
                only the finished reel is uploaded to Cloudinary so Buffer can
                fetch it. Change this in Profile.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="voice-date">Publish date (UTC)</Label>
              <Input
                id="voice-date"
                type="date"
                required={form.upload_to_buffer}
                value={form.scheduled_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scheduled_date: event.target.value,
                  }))
                }
                disabled={!form.upload_to_buffer}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-time">Publish time (UTC+0)</Label>
              <Input
                id="voice-time"
                type="time"
                required={form.upload_to_buffer}
                value={form.scheduled_time}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scheduled_time: event.target.value,
                  }))
                }
                disabled={!form.upload_to_buffer}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-surface p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium">
                Saved times for this language
              </p>
              {optionsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </div>

            {optionsError ? (
              <p className="text-[12px] text-rose-600">{optionsError}</p>
            ) : options && options.times.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {options.times.map((time) => (
                    <button
                      key={time.time}
                      type="button"
                      disabled={time.passed}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          scheduled_time: time.time,
                        }))
                      }
                      className={`tabular rounded-md border px-2 py-1 text-[12px] font-medium transition-colors ${
                        form.scheduled_time === time.time
                          ? "border-foreground bg-foreground text-background"
                          : time.passed
                            ? "cursor-not-allowed border-border text-muted-foreground/50"
                            : time.used
                              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300"
                              : "border-input bg-card hover:bg-secondary"
                      }`}
                      title={
                        time.used
                          ? "Already used on this date in this channel"
                          : time.passed
                            ? "This time already passed today (UTC)"
                            : "Use this time"
                      }
                    >
                      {time.time}
                      {time.used ? " · used" : ""}
                    </button>
                  ))}
                </div>
                {options.all_used ? (
                  <p className="text-[12px] text-amber-700">
                    All saved times are used on this date. Type a new time above.
                  </p>
                ) : options.suggested_time ? (
                  <p className="meta">
                    Suggested time: {options.suggested_time} UTC
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                No saved times for this language yet. Type a time above. It will
                be remembered for the next upload.
              </p>
            )}
          </div>
