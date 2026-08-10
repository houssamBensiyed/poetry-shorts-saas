"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Clock,
  Languages,
  Loader2,
  Pencil,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { PlatformChip } from "@/components/channels/platform-icon";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { channelArtwork } from "@/lib/channel-art";
import { apiFetch, errorText } from "@/lib/client";
import { formatUtcDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  DEFAULT_YOUTUBE_CATEGORY_ID,
  YOUTUBE_CATEGORIES,
  serviceLabel,
} from "@/lib/youtube";

type Destination = {
  id: string;
  buffer_channel_id: string;
  name: string;
  service: string;
  avatar: string | null;
  enabled: boolean;
  is_disconnected: boolean;
  is_locked: boolean;
  is_queue_paused: boolean;
  youtube_category_id: string | null;
  last_synced_at: string | null;
};

type Channel = {
  id: string;
  name: string;
  language: string;
  language_group: string;
  language_label: string;
  reel_style: "A" | "B";
  aspect_ratio: string;
  enabled: boolean;
  buffer_organization_id: string | null;
  buffer_organization_name: string | null;
  hasBufferToken: boolean;
  createdAt: string;
  destinations: Destination[];
  _count: { voices: number };
};

type PostingTime = {
  id: string;
  language_group: string;
  time: string;
  use_count: number;
  last_used_at: string;
};

type Group = {
  language_group: string;
  label: string;
  channel_count: number;
  times: PostingTime[];
};

type RemoteDestination = {
  id: string;
  name: string;
  displayName: string | null;
  service: string;
  avatar: string | null;
  isDisconnected: boolean;
  isLocked: boolean;
  isQueuePaused: boolean;
};

type RemoteOrganization = { id: string; name: string };

type ChannelForm = {
  name: string;
  language: string;
  reel_style: "A" | "B";
  buffer_access_token: string;
  organizationId: string;
  organizationName: string;
  enabled: boolean;
};

const emptyForm: ChannelForm = {
  name: "",
  language: "en",
  reel_style: "A",
  buffer_access_token: "",
  organizationId: "",
  organizationName: "",
  enabled: true,
};

type Selection = { selected: boolean; category: string };

type Health = {
  label: string;
  dot: string;
  ring: string;
};
