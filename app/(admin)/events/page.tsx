import Link from "next/link";
import type { EventStatus } from "@prisma/client";
import { listEvents } from "@/lib/actions/event";
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
import { EventsFilters } from "./EventsFilters";
import { parsePageParam } from "@/lib/pagination";

const VALID_STATUSES = ["DRAFT", "OPEN", "CLOSED", "DRAWN"] as const;

const STATUS_VARIANT: Record<EventStatus, "default" | "secondary" | "outline"> = {
  DRAFT: "outline",
  OPEN: "default",
  CLOSED: "secondary",
  DRAWN: "secondary",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function EventsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status =
    params.status && VALID_STATUSES.includes(params.status as EventStatus)
      ? (params.status as EventStatus)
      : "ALL";
  const search = params.q ?? "";
  const page = parsePageParam(params.page);

  const { events, pagination } = await listEvents({ status, search, page });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Events</h1>
          <p className="mt-2 text-muted-foreground">
            {pagination.total} {pagination.total === 1 ? "event" : "events"}
            {status !== "ALL" ? ` · ${status.toLowerCase()}` : ""}
            {search ? ` · matching “${search}”` : ""}
          </p>
        </div>
        <Link href="/events/new" className={buttonVariants()}>
          New event
        </Link>
      </div>

      <EventsFilters status={status} search={search} />

      {events.length === 0 ? (
        <EmptyState hasFilters={status !== "ALL" || !!search} />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead className="text-right">Prizes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.date
                      ? new Date(event.date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[event.status]}>
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {event._count.entries}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {event._count.prizes}
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
          status={status}
          search={search}
          hasPrev={pagination.hasPrev}
          hasNext={pagination.hasNext}
        />
      )}
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <p className="text-base font-medium">
        {hasFilters ? "No events match those filters." : "No events yet."}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters
          ? "Try clearing the filters."
          : "Create your first event to get started."}
      </p>
      {!hasFilters && (
        <Link
          href="/events/new"
          className={buttonVariants({ size: "sm" }) + " mt-4"}
        >
          New event
        </Link>
      )}
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  status: EventStatus | "ALL";
  search: string;
  hasPrev: boolean;
  hasNext: boolean;
}

function Pagination({
  page,
  totalPages,
  status,
  search,
  hasPrev,
  hasNext,
}: PaginationProps) {
  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (search) params.set("q", search);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/events?${qs}` : "/events";
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
