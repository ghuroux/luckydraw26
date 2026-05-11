import Link from "next/link";
import { notFound } from "next/navigation";
import type { EntrySource } from "@prisma/client";

import { getEvent } from "@/lib/actions/event";
import { listEntries } from "@/lib/actions/entry";
import { listPackages } from "@/lib/actions/package";
import { EmptyState, Pagination, StatusBadge } from "@/components/shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { entrySourceLabel, entrySourceTone } from "@/lib/entry-status";
import { formatMoney } from "@/lib/money";
import { parsePageParam } from "@/lib/pagination";
import { AddEntryButton } from "./AddEntryButton";
import { EntriesFilters } from "./EntriesFilters";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    paid?: string;
    source?: string;
    page?: string;
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
  const page = parsePageParam(sp.page);

  const [{ entries, pagination }, allPackages] = await Promise.all([
    listEntries({ eventId: id, paidFilter, source, page }),
    listPackages(id),
  ]);
  const activePackages = allPackages.filter((p) => p.isActive);

  const canAdd = event.status === "OPEN";
  const hasFilters = paidFilter !== "ALL" || source !== "ALL";

  const buildUrl = (p: number) => {
    const qs = new URLSearchParams();
    if (paidFilter !== "ALL") qs.set("paid", paidFilter);
    if (source !== "ALL") qs.set("source", source);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/events/${event.id}/entries?${s}` : `/events/${event.id}/entries`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{pagination.total}</span>{" "}
            {pagination.total === 1 ? "entry" : "entries"}
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

      {entries.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No entries match those filters." : "No entries yet."}
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
        <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/8">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-sunken/60 hover:bg-surface-sunken/60">
                <TableHead className="w-20">Ticket</TableHead>
                <TableHead>Entrant</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead className="text-right">Donation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono tabular-nums text-muted-foreground">
                    #{entry.ticketNumber}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/entrants/${entry.entrant.id}`}
                      className="hover:text-primary"
                    >
                      {entry.entrant.firstName} {entry.entrant.lastName}
                    </Link>
                    <p className="font-mono text-xs font-normal text-muted-foreground">
                      {entry.entrant.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={entrySourceTone(entry.source)}>
                      {entrySourceLabel(entry.source)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.package
                      ? `${entry.package.label} (${entry.packageEntryNum}/${entry.package.label.match(/\d+/)?.[0] ?? "?"})`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {entry.paidAt ? (
                      <StatusBadge tone="success" dot>
                        Paid
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="warning" dot>
                        Unpaid
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {entry.donationAmount
                      ? formatMoney(String(entry.donationAmount))
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          hasPrev={pagination.hasPrev}
          hasNext={pagination.hasNext}
          buildUrl={buildUrl}
        />
      )}
    </div>
  );
}
