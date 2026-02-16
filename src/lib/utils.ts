import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 0) return "—";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
}

export function truncate(value: string, length = 72) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

/**
 * Ask Cloudinary to serve the asset as an attachment so the browser downloads
 * it instead of navigating to the video. Non-Cloudinary URLs are unchanged.
 */
export function downloadUrl(url: string) {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }
  return url.replace("/upload/", "/upload/fl_attachment/");
}
