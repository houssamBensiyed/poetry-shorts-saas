import { Badge } from "@/components/ui/badge";
import {
  destinationStatusLabel,
  statusLabel,
  type DestinationStatusValue,
  type JobStatusValue,
} from "@/lib/types";

const toneByStatus: Record<
  JobStatusValue,
  "default" | "success" | "warning" | "info" | "danger" | "neutral" | "purple"
> = {
  queued: "neutral",
  processing: "warning",
  rendered: "info",
  submitting: "purple",
  scheduled: "info",
  publishing: "warning",
  partial: "warning",
  published: "success",
  completed: "success",
  failed: "danger",
};

export function StatusBadge({ status }: { status: JobStatusValue }) {
  const pulse =
    status === "processing" ||
    status === "submitting" ||
    status === "publishing";
