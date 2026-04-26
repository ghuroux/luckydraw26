import { requireUser } from "@/lib/rbac";
import { RoleGate } from "@/components/auth/RoleGate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await requireUser();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Phase 0 scaffolding complete. Phase 1 brings event and entrant CRUD.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signed in</CardTitle>
          <CardDescription>{session.user.email}</CardDescription>
        </CardHeader>
      </Card>

      <RoleGate
        minimum="SUPERADMIN"
        fallback={
          <p className="text-sm text-muted-foreground">
            (Hidden — only visible to SUPERADMIN.)
          </p>
        }
      >
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm">
              <span className="font-medium">SUPERADMIN-only block.</span>{" "}
              Visible because role gating is working.
            </p>
          </CardContent>
        </Card>
      </RoleGate>
    </div>
  );
}
