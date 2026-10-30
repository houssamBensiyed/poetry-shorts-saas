import { AdminQueueHealth } from "@/components/admin/admin-queue-health";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminQueuePage() {
  await requireAdmin();
  return <AdminQueueHealth />;
}
