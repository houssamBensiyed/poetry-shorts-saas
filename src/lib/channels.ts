import { languageLabel, normalizeLanguageGroup } from "@/lib/language";

export const channelSelect = {
  id: true,
  name: true,
  language: true,
  language_group: true,
  reel_style: true,
  aspect_ratio: true,
  enabled: true,
  buffer_organization_id: true,
  buffer_organization_name: true,
  buffer_access_token: true,
  createdAt: true,
  updatedAt: true,
  destinations: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      buffer_channel_id: true,
      name: true,
      service: true,
      avatar: true,
      enabled: true,
      is_disconnected: true,
      is_locked: true,
      is_queue_paused: true,
      youtube_category_id: true,
      last_synced_at: true,
      createdAt: true,
    },
  },
  _count: { select: { voices: true } },
} as const;

export function publicChannel<T extends { buffer_access_token: string }>(
  channel: T,
) {
  const { buffer_access_token, ...rest } = channel;
  return {
    ...rest,
    hasBufferToken: Boolean(buffer_access_token),
    language_label: languageLabel(
      (rest as { language_group?: string }).language_group ?? "en",
    ),
  };
}

/** A destination is usable only when it is enabled and Buffer says it is healthy. */
export function destinationReady(destination: {
  enabled: boolean;
  is_disconnected: boolean;
  is_locked: boolean;
  is_queue_paused: boolean;
}) {
  return (
    destination.enabled &&
    !destination.is_disconnected &&
    !destination.is_locked &&
    !destination.is_queue_paused
  );
}

export function destinationStatusLabel(destination: {
  enabled: boolean;
  is_disconnected: boolean;
  is_locked: boolean;
  is_queue_paused: boolean;
}) {
  if (destination.is_disconnected) return "Disconnected";
  if (destination.is_locked) return "Locked";
  if (destination.is_queue_paused) return "Queue paused";
  if (!destination.enabled) return "Off";
  return "Active";
}

export { normalizeLanguageGroup };
