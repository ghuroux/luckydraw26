import { notFound } from "next/navigation";
import { getEvent } from "@/lib/actions/event";
import { listPackages } from "@/lib/actions/package";
import { requireRole } from "@/lib/rbac";
import { PackagesManager } from "./PackagesManager";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PackagesPage({ params }: PageProps) {
  await requireRole("STAFF");
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const packages = await listPackages(id);

  const canEdit = event.status !== "DRAWN";

  const initial = packages.map((p) => ({
    id: p.id,
    label: p.label,
    quantity: p.quantity,
    cost: String(p.cost),
    isActive: p.isActive,
    entryCount: p._count.entries,
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Bulk deals — e.g. “5 entries for 200” — that entrants can pick during
        tablet capture and on the public portal. Single entries are always
        sold at the event's entry cost.
      </p>
      <PackagesManager
        eventId={event.id}
        initialPackages={initial}
        canEdit={canEdit}
      />
    </div>
  );
}
