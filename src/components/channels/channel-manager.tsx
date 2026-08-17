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

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    resetDiscovery();
    setModalOpen(true);
    setError(null);
  }

  function openEdit(channel: Channel) {
    setEditing(channel);
    setForm({
      name: channel.name,
      language: channel.language,
      reel_style: channel.reel_style,
      buffer_access_token: "",
      organizationId: channel.buffer_organization_id ?? "",
      organizationName: channel.buffer_organization_name ?? "",
      enabled: channel.enabled,
    });
    resetDiscovery();
    setModalOpen(true);
    setError(null);
  }

  async function loadOrganizations() {
    setLoadingOrganizations(true);
    setError(null);
    setOrganizations([]);
    platformRequest.current += 1;
    setRemote([]);
    setSelection({});
    try {
      const data = await apiFetch<{
        organizations: RemoteOrganization[];
        selected_organization_id?: string;
      }>("/api/buffer/organizations", {
        method: "POST",
        body: JSON.stringify({
          buffer_access_token: form.buffer_access_token.trim() || undefined,
          channelId: editing?.id,
        }),
      });
      setOrganizations(data.organizations);
      const selected =
        form.organizationId ||
        data.selected_organization_id ||
        (data.organizations.length === 1 ? data.organizations[0].id : "");
      if (selected) {
        const organization = data.organizations.find(
          (item) => item.id === selected,
        );
        setForm((current) => ({
          ...current,
          organizationId: selected,
          organizationName: organization?.name ?? current.organizationName,
        }));
        await loadPlatforms(selected);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoadingOrganizations(false);
    }
  }

  async function loadPlatforms(organizationId: string) {
    if (!organizationId) return;
    const request = platformRequest.current + 1;
    platformRequest.current = request;
    setLoadingPlatforms(true);
    setError(null);
    // Never leave platforms from another organization selectable.
    setRemote([]);
    setSelection({});
    try {
      const data = await apiFetch<{ channels: RemoteDestination[] }>(
        "/api/buffer/channels",
        {
          method: "POST",
          body: JSON.stringify({
            organization_id: organizationId,
            buffer_access_token: form.buffer_access_token.trim() || undefined,
            channelId: editing?.id,
          }),
        },
      );
      if (request !== platformRequest.current) return;
      setRemote(data.channels);

      const existing = new Map(
        (editing?.destinations ?? []).map((destination) => [
          destination.buffer_channel_id,
          destination,
        ]),
      );
      const next: Record<string, Selection> = {};
      for (const destination of data.channels) {
        const saved = existing.get(destination.id);
        next[destination.id] = {
          selected: saved ? saved.enabled : false,
          category:
            saved?.youtube_category_id ?? DEFAULT_YOUTUBE_CATEGORY_ID,
        };
      }
      setSelection(next);
    } catch (err) {
      if (request === platformRequest.current) {
        setRemote([]);
        setSelection({});
        setError(errorText(err));
      }
    } finally {
      if (request === platformRequest.current) {
        setLoadingPlatforms(false);
      }
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const destinations = remote
        .filter((destination) => selection[destination.id]?.selected)
        .map((destination) => ({
          buffer_channel_id: destination.id,
          name: destination.displayName || destination.name,
          service: destination.service,
          avatar: destination.avatar,
          enabled: true,
          youtube_category_id:
            destination.service === "youtube"
              ? selection[destination.id]?.category ??
                DEFAULT_YOUTUBE_CATEGORY_ID
              : null,
        }));

      const platformsLoaded = remote.length > 0;
      if (!platformsLoaded && !editing) {
        setError("Load your Buffer organizations and select at least one platform.");
        setSaving(false);
        return;
      }
      if (platformsLoaded && destinations.length === 0) {
        setError("Select at least one Buffer destination.");
        setSaving(false);
        return;
      }

      const body: Record<string, unknown> = {
        name: form.name,
        language: form.language,
        reel_style: form.reel_style,
        enabled: form.enabled,
        buffer_organization_id: form.organizationId || null,
        buffer_organization_name: form.organizationName || null,
      };
      // Only send destinations when they were actually loaded. Sending an
      // empty list after a rename would disable every existing platform.
      if (platformsLoaded) {
        body.destinations = destinations;
      }
      if (form.buffer_access_token.trim()) {
        body.buffer_access_token = form.buffer_access_token.trim();
      }

      if (editing) {
        await apiFetch(`/api/channels/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        setNotice(`Channel “${form.name}” updated.`);
      } else {
        await apiFetch("/api/channels", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setNotice(`Channel “${form.name}” created.`);
      }

      setModalOpen(false);
      setEditing(null);
      resetDiscovery();
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(channel: Channel) {
    setError(null);
    try {
      await apiFetch(`/api/channels/${channel.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !channel.enabled }),
      });
      setNotice(
        `Channel “${channel.name}” ${channel.enabled ? "disabled" : "enabled"}.`,
      );
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function refresh(channel: Channel) {
    setBusyId(channel.id);
    setError(null);
    try {
      const data = await apiFetch<{
        created: number;
        updated: number;
      }>(`/api/channels/${channel.id}/refresh-destinations`, {
        method: "POST",
      });
      setNotice(
        `Platforms refreshed: ${data.created} new, ${data.updated} updated. New platforms start switched off.`,
      );
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(channel: Channel) {
    if (
      !window.confirm(
        `Delete “${channel.name}”? Its ${channel._count.voices} voice(s) and publish history will be removed.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/channels/${channel.id}`, { method: "DELETE" });
      setNotice(`Channel “${channel.name}” deleted.`);
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function addTime() {
    if (!timesGroup || !newTime) return;
    setError(null);
    try {
      await apiFetch("/api/posting-times", {
        method: "POST",
        body: JSON.stringify({
          group: timesGroup.language_group,
          time: newTime,
        }),
      });
      setNewTime("");
      await load();
      const refreshed = await apiFetch<{ groups: Group[] }>("/api/channels");
      setTimesGroup(
        refreshed.groups.find(
          (group) => group.language_group === timesGroup.language_group,
        ) ?? null,
      );
    } catch (err) {
      setError(errorText(err));
    }
  }
