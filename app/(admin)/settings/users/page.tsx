import { PageHeader } from "@/components/shell";
import { listUsers } from "@/lib/actions/user";
import { requireRole } from "@/lib/rbac";
import { UsersTable } from "./UsersTable";

export default async function UsersSettingsPage() {
  const session = await requireRole("SUPERADMIN");
  const users = await listUsers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Create accounts and review who has access. New users are required to change their password on first sign in."
      />
      <UsersTable users={users} currentUserId={session.user.id} />
    </div>
  );
}
