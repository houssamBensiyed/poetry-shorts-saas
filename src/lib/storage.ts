import path from "node:path";
import { stat } from "node:fs/promises";

export type StorageMode = "LOCAL" | "REMOTE";

/**
 * Return the shared local-media folder. Local mode is opt-in, so a missing
 * variable is a configuration error rather than a silent fallback.
 */
export function localMediaRoot(): string {
  const configured = process.env.LOCAL_MEDIA_ROOT?.trim();
  if (!configured) {
    throw new Error(
      "Local storage is not configured. Set LOCAL_MEDIA_ROOT to the folder shared with the render engine.",
    );
  }
  if (!path.isAbsolute(configured)) {
    throw new Error("LOCAL_MEDIA_ROOT must be an absolute path.");
  }
  return path.resolve(configured);
}

/** Build the stored path for one voice's uploaded audio. */
export function localVoicePath(voiceId: string, extension: string): string {
  return path.join(localMediaRoot(), "voices", `${voiceId}.${extension}`);
}

/**
 * Confine a stored path to LOCAL_MEDIA_ROOT. Reject relative paths, traversal,
 * and (optionally) missing or empty files so a forged path cannot read anything
 * else on the host.
 */
export async function resolveLocalFile(
  value: string,
  { mustExist = true }: { mustExist?: boolean } = {},
): Promise<string> {
  if (!path.isAbsolute(value)) {
    throw new Error("A local media path must be absolute.");
  }
  const root = localMediaRoot();
  const resolved = path.resolve(value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("The file is outside the shared local media folder.");
  }
  if (mustExist) {
    const info = await stat(resolved);
    if (!info.isFile()) {
      throw new Error("The local media path is not a file.");
    }
    if (info.size === 0) {
      throw new Error("The local media file is empty.");
    }
  }
  return resolved;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
