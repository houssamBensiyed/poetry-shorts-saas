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
