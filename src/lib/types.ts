export type AppRole = "USER" | "ADMIN";

export const JOB_STATUSES = [
  "queued",
  "processing",
  "rendered",
  "submitting",
  "scheduled",
  "publishing",
  "partial",
  "published",
  "completed",
  "failed",
] as const;

export type JobStatusValue = (typeof JOB_STATUSES)[number];

export const REEL_STYLES = ["A", "B"] as const;

export type ReelStyleValue = (typeof REEL_STYLES)[number];

export const statusLabel: Record<JobStatusValue, string> = {
  queued: "Queued",
  processing: "Rendering",
  rendered: "Rendered",
  submitting: "Uploading",
  scheduled: "Scheduled",
  publishing: "Publishing",
  partial: "Partially published",
  published: "Published",
  completed: "Completed",
  failed: "Failed",
};

/** Statuses that mean the worker is still running this voice. */
export const activeStatuses: JobStatusValue[] = [
  "processing",
  "rendered",
  "submitting",
];

/** Statuses where the Buffer post still needs to be checked. */
export const syncableStatuses: JobStatusValue[] = [
  "scheduled",
  "publishing",
  "partial",
];

export const DESTINATION_STATUSES = [
  "scheduled",
  "publishing",
  "published",
  "failed",
] as const;

export type DestinationStatusValue = (typeof DESTINATION_STATUSES)[number];

export const destinationStatusLabel: Record<DestinationStatusValue, string> = {
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
};
