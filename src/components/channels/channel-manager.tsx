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

function channelHealth(channel: Channel): Health {
  if (!channel.enabled) {
    return {
      label: "Disabled",
      dot: "bg-white/55",
      ring: "border-white/25 bg-black/35",
    };
  }
  if (channel.destinations.length === 0) {
    return {
      label: "No platforms",
      dot: "bg-amber-400",
      ring: "border-white/25 bg-black/35",
    };
  }
  const enabledDestinations = channel.destinations.filter(
    (destination) => destination.enabled,
  );
  if (enabledDestinations.length === 0) {
    return {
      label: "No active platforms",
      dot: "bg-amber-400",
      ring: "border-white/25 bg-black/35",
    };
  }
  if (
    enabledDestinations.some(
      (destination) => destination.is_disconnected || destination.is_locked,
    )
  ) {
    return {
      label: "Needs attention",
      dot: "bg-rose-400",
      ring: "border-white/25 bg-black/35",
    };
  }
  if (
    enabledDestinations.some((destination) => destination.is_queue_paused)
  ) {
    return {
      label: "Queue paused",
      dot: "bg-amber-400",
      ring: "border-white/25 bg-black/35",
    };
  }
  return {
    label: "Active",
    dot: "bg-emerald-400",
    ring: "border-white/25 bg-black/35",
  };
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        danger && "hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}

export function ChannelManager() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [form, setForm] = useState<ChannelForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [organizations, setOrganizations] = useState<RemoteOrganization[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [remote, setRemote] = useState<RemoteDestination[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);
  const [selection, setSelection] = useState<Record<string, Selection>>({});
  const platformRequest = useRef(0);

  const [timesGroup, setTimesGroup] = useState<Group | null>(null);
  const [newTime, setNewTime] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ channels: Channel[]; groups: Group[] }>(
        "/api/channels",
      );
      setChannels(data.channels);
      setGroups(data.groups);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        channels: channels.filter(
          (channel) => channel.language_group === group.language_group,
        ),
      }))
      .filter((group) => group.channels.length > 0 || group.times.length > 0);
  }, [groups, channels]);

  const activeGroup =
    grouped.find((group) => group.language_group === selectedGroup) ??
    grouped[0] ??
    null;

  function resetDiscovery() {
    platformRequest.current += 1;
    setOrganizations([]);
    setRemote([]);
    setSelection({});
    setLoadingPlatforms(false);
  }
