import { requireUser } from "@/lib/rbac";
import { RoleGate } from "@/components/auth/RoleGate";

export default async function DashboardPage() {
  const session = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted">
          Phase 0 scaffolding complete. Phase 1 brings event and entrant CRUD.
        </p>
      </div>

      <div className="rounded-lg border border-muted/30 p-4">
        <p className="text-sm">
          Signed in as{" "}
          <span className="font-medium text-foreground">
            {session.user.email}
          </span>
        </p>
      </div>

      <RoleGate
        minimum="SUPERADMIN"
        fallback={
          <p className="text-sm text-muted">
            (Hidden block — only visible to SUPERADMIN.)
          </p>
        }
      >
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm">
            <span className="font-medium">SUPERADMIN-only block.</span> If you
            can see this, role gating is working.
          </p>
        </div>
      </RoleGate>
    </div>
  );
}
