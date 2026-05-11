import { notFound } from "next/navigation";

import { getEvent } from "@/lib/actions/event";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { EditEventForm } from "./EditEventForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: PageProps) {
  await requireRole("ADMIN");
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const lockedPrizeCount = await db.prize.count({
    where: { eventId: event.id, lockedAt: { not: null } },
  });

  const defaultValues = {
    name: event.name,
    description: event.description ?? "",
    date: event.date
      ? new Date(event.date).toISOString().slice(0, 10)
      : "",
    drawTime: event.drawTime ?? "",
    entryCost: String(event.entryCost),
    prizePool: event.prizePool ? String(event.prizePool) : "",
    drawMode: event.drawMode,
    showSupporterIntro: event.showSupporterIntro,
    showSupporterNames: event.showSupporterNames,
    showSupporterTicketCounts: event.showSupporterTicketCounts,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-display-2xs font-semibold tracking-tight">
          Edit basics
        </h2>
        {event.status === "OPEN" && (
          <p className="text-sm text-muted-foreground">
            This event is open for entries — be careful editing entry cost or
            packages while sales are live.
          </p>
        )}
      </div>

      <EditEventForm
        eventId={event.id}
        defaultValues={defaultValues}
        drawModeLocked={lockedPrizeCount > 0}
      />
    </div>
  );
}
