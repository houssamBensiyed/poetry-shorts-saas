export const DEFAULT_AVATARS = [
  "/avatars/wall-01.svg",
  "/avatars/wall-02.svg",
  "/avatars/wall-03.svg",
  "/avatars/wall-04.svg",
  "/avatars/wall-05.svg",
  "/avatars/wall-06.svg",
] as const;

export function isDefaultAvatar(value: string) {
  return (DEFAULT_AVATARS as readonly string[]).includes(value);
}

/** Stable built-in avatar for accounts that have not chosen one. */
export function defaultAvatarFor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return DEFAULT_AVATARS[hash % DEFAULT_AVATARS.length];
}

export function resolveAvatar(
  avatarUrl: string | null | undefined,
  seed: string,
) {
  if (!avatarUrl) return defaultAvatarFor(seed);
  return avatarUrl;
}

export function displayName(
  name: string | null | undefined,
  email: string,
) {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function initials(name: string | null | undefined, email: string) {
  const source = displayName(name, email);
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return email.slice(0, 1).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
