import Link from "next/link";
import { notFound } from "next/navigation";
import type { EntrySource } from "@prisma/client";
import { getEvent } from "@/lib/actions/event";
import { listEntries } from "@/lib/actions/entry";
import { listPackages } from "@/lib/actions/package";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {pagination.total}{" "}
          {pagination.total === 1 ? "entry" : "entries"}
          {paidFilter !== "ALL" ? ` · ${paidFilter.toLowerCase()}` : ""}
          {source !== "ALL" ? ` · via ${source.toLowerCase()}` : ""}
        </p>
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
          hasFilters={paidFilter !== "ALL" || source !== "ALL"}
          status={event.status}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ticket</TableHead>
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
                    <p className="text-xs font-normal text-muted-foreground">
                      {entry.entrant.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {entry.source.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.package
                      ? `${entry.package.label} (${entry.packageEntryNum}/${entry.package.label.match(/\d+/)?.[0] ?? "?"})`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {entry.paidAt ? (
                      <Badge variant="default">Paid</Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-amber-700 dark:text-amber-400"
                      >
                        Unpaid
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {entry.donationAmount ? String(entry.donationAmount) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <Pagination
          eventId={event.id}
          page={pagination.page}
          totalPages={pagination.totalPages}
          paidFilter={paidFilter}
          source={source}
          hasPrev={pagination.hasPrev}
          hasNext={pagination.hasNext}
        />
      )}
    </div>
  );
}

function EmptyState({
  hasFilters,
  status,
}: {
  hasFilters: boolean;
  status: string;
}) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <p className="text-base font-medium">
        {hasFilters ? "No entries match those filters." : "No entries yet."}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters
          ? "Try clearing the filters."
          : status === "OPEN"
            ? "Click Add entry to record one."
            : status === "DRAFT"
              ? "Open the event before adding entries."
              : `Event is ${status.toLowerCase()} — entries can't be added.`}
      </p>
    </div>
  );
}

interface PaginationProps {
  eventId: string;
  page: number;
  totalPages: number;
  paidFilter: PaidFilter;
  source: EntrySource | "ALL";
  hasPrev: boolean;
  hasNext: boolean;
}

function Pagination({
  eventId,
  page,
  totalPages,
  paidFilter,
  source,
  hasPrev,
  hasNext,
}: PaginationProps) {
  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (paidFilter !== "ALL") params.set("paid", paidFilter);
    if (source !== "ALL") params.set("source", source);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs
      ? `/events/${eventId}/entries?${qs}`
      : `/events/${eventId}/entries`;
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Link
          href={buildUrl(page - 1)}
          className={
            buttonVariants({ variant: "outline", size: "sm" }) +
            (hasPrev ? "" : " pointer-events-none opacity-50")
          }
          aria-disabled={!hasPrev}
        >
          Previous
        </Link>
        <Link
          href={buildUrl(page + 1)}
          className={
            buttonVariants({ variant: "outline", size: "sm" }) +
            (hasNext ? "" : " pointer-events-none opacity-50")
          }
          aria-disabled={!hasNext}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
