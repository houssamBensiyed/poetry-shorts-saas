/** All scheduling is UTC+0. Nothing here reads the browser timezone. */

export const UTC_LABEL = "UTC";

export function minutesToTime(minutes: number) {
  const safe = Math.min(Math.max(Math.round(minutes), 0), 1439);
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function timeToMinutes(time: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Build a Date from separate UTC date and time fields, never local time. */
export function utcDateTime(date: string, time: string) {
  const day = date.trim();
  const clock = time.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  if (timeToMinutes(clock) === null) return null;

  const value = new Date(`${day}T${clock}:00.000Z`);
  if (Number.isNaN(value.getTime())) return null;
  // Reject impossible dates such as 2026-02-31.
  if (value.toISOString().slice(0, 10) !== day) return null;
  return value;
}

export function utcDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

export function utcTimeKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(11, 16);
}

export function todayUtcKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Example: "20 Nov 2026, 18:30 UTC". */
export function formatUtcDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
  return `${formatted} ${UTC_LABEL}`;
}

/** Example: "18:30 UTC". */
export function formatUtcTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toISOString().slice(11, 16)} ${UTC_LABEL}`;
}
