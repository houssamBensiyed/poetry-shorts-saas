import { QueueMonitor } from "@/components/queue/queue-monitor";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  await requireUser();
  return <QueueMonitor />;
}
