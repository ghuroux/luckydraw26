import Link from "next/link";
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
    <div className="space-y-6">
      <div>
        <Link
          href={`/events/${event.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {event.name}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Prizes</h1>
        <p className="mt-2 text-muted-foreground">
          {prizes.length === 0
            ? "Add at least one prize before opening the event."
            : `${prizes.length} ${prizes.length === 1 ? "prize" : "prizes"}, drawn in the order shown.`}
        </p>
      </div>

      <PrizesManager
        eventId={event.id}
        initialPrizes={prizes}
        canEdit={canEdit}
      />
    </div>
  );
}
