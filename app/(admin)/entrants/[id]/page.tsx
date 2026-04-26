import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntrant } from "@/lib/actions/entrant";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EntrantProfile } from "./EntrantProfile";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EntrantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const entrant = await getEntrant(id);
  if (!entrant) notFound();

  // Group entries by event for the history view.
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
    <div className="space-y-6">
      <div>
        <Link
          href="/entrants"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Entrants
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {entrant.firstName} {entrant.lastName}
        </h1>
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

      <Card>
        <CardHeader>
          <CardTitle>Entry history</CardTitle>
        </CardHeader>
        <CardContent>
          {entrant.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entries yet.
            </p>
          ) : (
            <div className="space-y-4">
              {[...groups.values()].map(({ event, entries }) => (
                <EventEntryGroup key={event.id} event={event} entries={entries} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
    <div className="rounded-md border p-4">
      <div className="flex items-baseline justify-between gap-4">
        <Link
          href={`/events/${event.id}`}
          className="font-medium hover:text-primary"
        >
          {event.name}
        </Link>
        <span className="text-xs text-muted-foreground">
          {event.date
            ? new Date(event.date).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "entry" : "entries"} ·{" "}
          {entries
            .map((e) => `#${e.ticketNumber}`)
            .slice(0, 8)
            .join(", ")}
          {entries.length > 8 ? ` +${entries.length - 8} more` : ""}
        </span>
        {!allPaid && (
          <Badge variant="outline" className="text-amber-600">
            Unpaid
          </Badge>
        )}
      </div>
    </div>
  );
}
