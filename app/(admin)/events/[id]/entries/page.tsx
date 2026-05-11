import { notFound } from "next/navigation";
import type { EntrySource } from "@prisma/client";

import { getEvent } from "@/lib/actions/event";
import { listEntrantSummariesForEvent } from "@/lib/actions/entry";
import { listPackages } from "@/lib/actions/package";
import { EmptyState } from "@/components/shell";
import { AddEntryButton } from "./AddEntryButton";
import { EntriesFilters } from "./EntriesFilters";
import { EntrantEntriesTable } from "./EntrantEntriesTable";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    paid?: string;
    source?: string;
  }>;
}

const PAID_OPTIONS = ["ALL", "PAID", "UNPAID"] as const;
const SOURCE_OPTIONS = ["ALL", "ADMIN", "TABLET", "PUBLIC"] as const;

type PaidFilter = (typeof PAID_OPTIONS)[number];

export default async function EntriesPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const event = await getEvent(id);
  if (!event) notFound();

  const paidFilter: PaidFilter =
    sp.paid && PAID_OPTIONS.includes(sp.paid as PaidFilter)
      ? (sp.paid as PaidFilter)
      : "ALL";
  const source =
    sp.source && SOURCE_OPTIONS.includes(sp.source as EntrySource | "ALL")
      ? (sp.source as EntrySource | "ALL")
      : "ALL";

  const [{ entrants, total }, allPackages] = await Promise.all([
    listEntrantSummariesForEvent({ eventId: id, paidFilter, source }),
    listPackages(id),
  ]);
  const activePackages = allPackages.filter((p) => p.isActive);

  const canAdd = event.status === "OPEN";
  const hasFilters = paidFilter !== "ALL" || source !== "ALL";

  const totalTickets = entrants.reduce((sum, e) => sum + e.ticketCount, 0);
  const totalUnpaid = entrants.reduce((sum, e) => sum + e.unpaidCount, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{total}</span>{" "}
            {total === 1 ? "entrant" : "entrants"}
            {" · "}
            <span className="font-mono tabular-nums">{totalTickets}</span>{" "}
            {totalTickets === 1 ? "ticket" : "tickets"}
            {totalUnpaid > 0 && (
              <>
                {" · "}
                <span className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
                  {totalUnpaid}
                </span>{" "}
                unpaid
              </>
            )}
            {paidFilter !== "ALL" ? ` · ${paidFilter.toLowerCase()}` : ""}
            {source !== "ALL" ? ` · via ${source.toLowerCase()}` : ""}
          </p>
        </div>
        {canAdd && (
          <AddEntryButton
            eventId={event.id}
            entryCost={String(event.entryCost)}
            packages={activePackages.map((p) => ({
              id: p.id,
              label: p.label,
              quantity: p.quantity,
              cost: String(p.cost),
            }))}
          />
        )}
      </div>

      <EntriesFilters
        eventId={event.id}
        paidFilter={paidFilter}
        source={source}
      />

      {entrants.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No entrants match those filters." : "No entries yet."}
          description={
            hasFilters
              ? "Try clearing the filters."
              : event.status === "OPEN"
                ? "Click Add entry to record one."
                : event.status === "DRAFT"
                  ? "Open the event before adding entries."
                  : `Event is ${event.status.toLowerCase()} — entries can't be added.`
          }
        />
      ) : (
        <EntrantEntriesTable eventId={event.id} entrants={entrants} />
      )}
    </div>
  );
}
