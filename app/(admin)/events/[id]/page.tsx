import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Tablet, UserPlus } from "lucide-react";

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

      <QuickActions eventId={event.id} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Schedule">
          <div className="space-y-3 text-sm">
            <DetailRow
              label="Date"
              value={
                event.date
                  ? new Date(event.date).toLocaleDateString("en-ZA", {
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
                value={new Date(event.drawnAt).toLocaleString("en-ZA")}
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

function QuickActions({ eventId }: { eventId: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Quick actions
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/events/${eventId}/tablet-capture`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-foreground shadow-xs transition-all hover:border-primary/60 hover:bg-primary/10 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Tablet className="size-4 text-primary" />
          <span>Open tablet capture</span>
          <ExternalLink className="size-3.5 text-primary/70" />
        </Link>
        <Link
          href="/entrants"
          className="inline-flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-foreground shadow-xs transition-all hover:border-primary/60 hover:bg-primary/10 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <UserPlus className="size-4 text-primary" />
          <span>Add entrant</span>
        </Link>
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
