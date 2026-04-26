import { notFound } from "next/navigation";
import { getEvent } from "@/lib/actions/event";
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

  const defaultValues = {
    name: event.name,
    description: event.description ?? "",
    date: event.date
      ? new Date(event.date).toISOString().slice(0, 10)
      : "",
    drawTime: event.drawTime ?? "",
    entryCost: String(event.entryCost),
    prizePool: event.prizePool ? String(event.prizePool) : "",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Edit basics</h2>
        {event.status === "OPEN" && (
          <p className="mt-2 text-sm text-muted-foreground">
            This event is open for entries — be careful editing entry cost or
            packages while sales are live.
          </p>
        )}
      </div>

      <EditEventForm eventId={event.id} defaultValues={defaultValues} />
    </div>
  );
}
