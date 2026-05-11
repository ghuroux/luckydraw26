import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getEntrant } from "@/lib/actions/entrant";
import { PageHeader, Section, StatusBadge } from "@/components/shell";
import { EntrantProfile } from "./EntrantProfile";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EntrantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const entrant = await getEntrant(id);
  if (!entrant) notFound();

  const groups = new Map<
    string,
    {
      event: { id: string; name: string; date: Date | null };
      entries: typeof entrant.entries;
    }
  >();
  for (const entry of entrant.entries) {
    const existing = groups.get(entry.event.id);
    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.set(entry.event.id, {
        event: {
          id: entry.event.id,
          name: entry.event.name,
          date: entry.event.date,
        },
        entries: [entry],
      });
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <Link
          href="/entrants"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Entrants
        </Link>
        <PageHeader title={`${entrant.firstName} ${entrant.lastName}`} />
      </div>

      <EntrantProfile
        entrant={{
          id: entrant.id,
          firstName: entrant.firstName,
          lastName: entrant.lastName,
          email: entrant.email,
          phone: entrant.phone ?? "",
          dateOfBirth: entrant.dateOfBirth
            ? new Date(entrant.dateOfBirth).toISOString().slice(0, 10)
            : "",
          sponsorShareOptIn: entrant.sponsorShareOptIn,
          smsOptIn: entrant.smsOptIn,
        }}
      />

      <Section title="Entry history">
        {entrant.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <div className="space-y-3">
            {[...groups.values()].map(({ event, entries }) => (
              <EventEntryGroup key={event.id} event={event} entries={entries} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

interface EventEntryGroupProps {
  event: { id: string; name: string; date: Date | null };
  entries: Array<{
    id: string;
    ticketNumber: number;
    paidAt: Date | null;
    source: "ADMIN" | "TABLET" | "PUBLIC";
    package: { id: string; label: string } | null;
  }>;
}

function EventEntryGroup({ event, entries }: EventEntryGroupProps) {
  const allPaid = entries.every((e) => e.paidAt !== null);
  return (
    <div className="rounded-xl bg-surface-sunken/60 p-4 ring-1 ring-foreground/8">
      <div className="flex items-baseline justify-between gap-4">
        <Link
          href={`/events/${event.id}`}
          className="font-medium hover:text-primary"
        >
          {event.name}
        </Link>
        <span className="text-xs text-muted-foreground">
          {event.date
            ? new Date(event.date).toLocaleDateString("en-ZA", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          <span className="font-mono tabular-nums">{entries.length}</span>{" "}
          {entries.length === 1 ? "entry" : "entries"} ·{" "}
          <span className="font-mono tabular-nums">
            {entries
              .map((e) => `#${e.ticketNumber}`)
              .slice(0, 8)
              .join(", ")}
            {entries.length > 8 ? ` +${entries.length - 8} more` : ""}
          </span>
        </span>
        {!allPaid && (
          <StatusBadge tone="warning" dot>
            Unpaid
          </StatusBadge>
        )}
      </div>
    </div>
  );
}
