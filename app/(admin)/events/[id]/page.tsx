import { notFound } from "next/navigation";

import { getEvent } from "@/lib/actions/event";
import { Section, StatCard } from "@/components/shell";
import { formatMoney } from "@/lib/money";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Entries"
          value={event._count.entries}
          href={`/events/${event.id}/entries`}
        />
        <StatCard
          label="Prizes"
          value={event._count.prizes}
          href={`/events/${event.id}/prizes`}
        />
        <StatCard
          label="Packages"
          value={event._count.packages}
          href={`/events/${event.id}/packages`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Schedule">
          <div className="space-y-3 text-sm">
            <DetailRow
              label="Date"
              value={
                event.date
                  ? new Date(event.date).toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"
              }
            />
            <DetailRow label="Draw time" value={event.drawTime ?? "—"} />
            {event.drawnAt && (
              <DetailRow
                label="Drawn at"
                value={new Date(event.drawnAt).toLocaleString()}
              />
            )}
          </div>
        </Section>

        <Section title="Money">
          <div className="space-y-3 text-sm">
            <DetailRow
              label="Entry cost"
              value={formatMoney(String(event.entryCost))}
              mono
            />
            <DetailRow
              label="Prize pool"
              value={
                event.prizePool ? formatMoney(String(event.prizePool)) : "—"
              }
              mono
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono tabular-nums" : ""}>{value}</span>
    </div>
  );
}
