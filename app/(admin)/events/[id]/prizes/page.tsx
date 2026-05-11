import { notFound } from "next/navigation";

import { getEvent } from "@/lib/actions/event";
import { listPrizes } from "@/lib/actions/prize";
import { requireRole } from "@/lib/rbac";
import { PrizesManager } from "./PrizesManager";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PrizesPage({ params }: PageProps) {
  await requireRole("STAFF");
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const prizes = await listPrizes(id);

  const canEdit = event.status !== "DRAWN";

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {prizes.length === 0 ? (
          "Add at least one prize before opening the event."
        ) : (
          <>
            <span className="font-mono tabular-nums">{prizes.length}</span>{" "}
            {prizes.length === 1 ? "prize" : "prizes"}, drawn in the order shown.
          </>
        )}
      </p>
      <PrizesManager
        eventId={event.id}
        initialPrizes={prizes}
        canEdit={canEdit}
      />
    </div>
  );
}
