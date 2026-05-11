import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { RoleGate } from "@/components/auth/RoleGate";
import { PageHeader, Section, StatCard } from "@/components/shell";

export default async function DashboardPage() {
  const session = await requireUser();

  const [eventsTotal, eventsOpen, entrantsTotal] = await Promise.all([
    db.event.count(),
    db.event.count({ where: { status: "OPEN" } }),
    db.entrant.count(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back`}
        description={
          <>
            Signed in as{" "}
            <span className="font-mono text-foreground">
              {session.user.email}
            </span>
            .
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Events" value={eventsTotal} href="/events" />
        <StatCard
          label="Open events"
          value={eventsOpen}
          hint={eventsOpen === 0 ? "no live events" : "accepting entries"}
        />
        <StatCard label="Entrants" value={entrantsTotal} href="/entrants" />
      </div>

      <RoleGate
        minimum="SUPERADMIN"
        fallback={null}
      >
        <Section
          title="Superadmin"
          description="Visible because role gating is working."
        >
          <p className="text-sm text-muted-foreground">
            Organisation-level controls land here as the platform grows.
          </p>
        </Section>
      </RoleGate>
    </div>
  );
}
