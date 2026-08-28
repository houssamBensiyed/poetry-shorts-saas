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
