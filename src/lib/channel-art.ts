export const CHANNEL_ART = [
  "/avatars/wall-01.svg",
  "/avatars/wall-02.svg",
  "/avatars/wall-03.svg",
  "/avatars/wall-04.svg",
  "/avatars/wall-05.svg",
  "/avatars/wall-06.svg",
] as const;

export function channelArtwork(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return CHANNEL_ART[(hash >>> 0) % CHANNEL_ART.length];
}
