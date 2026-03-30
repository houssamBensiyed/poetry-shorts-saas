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

function mediaUrl(voiceId: string, kind: "audio" | "video") {
  return `/api/voices/${voiceId}/media?kind=${kind}`;
}

function isStoredLocalPath(value: string | null | undefined) {
  if (!value) return false;
  return !/^https?:\/\//i.test(value);
}

type VoiceWithMedia = {
  id: string;
  storage_mode: string;
  audio_url?: string | null;
  rendered_video_url?: string | null;
  buffer_video_url?: string | null;
};

/**
 * Replace local absolute paths with the streaming endpoint. Non-local voices
 * and already-safe URLs are passed through.
 */
export function publicVoice<T extends VoiceWithMedia>(voice: T): T {
  if (voice.storage_mode !== "LOCAL") return voice;

  return {
    ...voice,
    audio_url: isStoredLocalPath(voice.audio_url)
      ? mediaUrl(voice.id, "audio")
      : voice.audio_url,
    rendered_video_url: isStoredLocalPath(voice.rendered_video_url)
      ? mediaUrl(voice.id, "video")
      : voice.rendered_video_url,
    buffer_video_url: isStoredLocalPath(voice.buffer_video_url)
      ? null
      : voice.buffer_video_url,
  };
}

export function publicVoices<T extends VoiceWithMedia>(voices: T[]): T[] {
  return voices.map(publicVoice);
}
