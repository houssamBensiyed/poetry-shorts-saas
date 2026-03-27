/**
 * Shared voice query shape and serializer.
 *
 * The browser renders local-media voices through `/api/voices/:id/media`, so
 * raw filesystem paths must never leave the server. Remote (Cloudinary) URLs
 * are already safe and are returned unchanged.
 */

export const voiceInclude = {
  channel: {
    select: {
      id: true,
      name: true,
      language: true,
      language_group: true,
      reel_style: true,
    },
  },
  publishes: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      buffer_post_id: true,
      error_message: true,
      scheduled_at: true,
      published_at: true,
      external_url: true,
      last_synced_at: true,
      destination: {
        select: {
          id: true,
          name: true,
          service: true,
          buffer_channel_id: true,
          enabled: true,
        },
      },
    },
  },
} as const;
