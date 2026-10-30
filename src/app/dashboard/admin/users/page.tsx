import { AdminUsers } from "@/components/admin/admin-users";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  return <AdminUsers />;
}
