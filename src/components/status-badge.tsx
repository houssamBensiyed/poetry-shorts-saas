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

  return (
    <Badge tone={toneByStatus[status]} className="gap-1.5">
      <span
        className={
          pulse
            ? "h-1.5 w-1.5 animate-pulse rounded-full bg-current"
            : "h-1.5 w-1.5 rounded-full bg-current opacity-70"
        }
      />
      {statusLabel[status]}
    </Badge>
  );
}

const toneByDestination: Record<
  DestinationStatusValue,
  "success" | "warning" | "info" | "danger"
> = {
  scheduled: "info",
  publishing: "warning",
  published: "success",
  failed: "danger",
};

export function DestinationBadge({ status }: { status: DestinationStatusValue }) {
  return (
    <Badge tone={toneByDestination[status]} className="gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {destinationStatusLabel[status]}
    </Badge>
  );
}
