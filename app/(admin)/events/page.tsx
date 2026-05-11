import Link from "next/link";
import type { EventStatus } from "@prisma/client";

import { listEvents } from "@/lib/actions/event";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader, Pagination } from "@/components/shell";
import { parsePageParam } from "@/lib/pagination";
import { EventsFilters } from "./EventsFilters";
import { EventsTable } from "./EventsTable";

const VALID_STATUSES = ["DRAFT", "OPEN", "CLOSED", "DRAWN"] as const;

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

  const hasFilters = status !== "ALL" || !!search;

  const buildUrl = (p: number) => {
    const qs = new URLSearchParams();
    if (status !== "ALL") qs.set("status", status);
    if (search) qs.set("q", search);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/events?${s}` : "/events";
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Events"
        description={
          <>
            <span className="font-mono tabular-nums">{pagination.total}</span>{" "}
            {pagination.total === 1 ? "event" : "events"}
            {status !== "ALL" ? ` · ${status.toLowerCase()}` : ""}
            {search ? ` · matching “${search}”` : ""}
          </>
        }
        actions={
          <Link href="/events/new" className={buttonVariants()}>
            New event
          </Link>
        }
      />

      <EventsFilters status={status} search={search} />

      {events.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No events match those filters." : "No events yet."}
          description={
            hasFilters
              ? "Try clearing the filters."
              : "Create your first event to get started."
          }
          action={
            hasFilters ? null : (
              <Link
                href="/events/new"
                className={buttonVariants({ size: "sm" })}
              >
                New event
              </Link>
            )
          }
        />
      ) : (
        <EventsTable
          events={events.map((e) => ({
            id: e.id,
            name: e.name,
            date: e.date,
            status: e.status,
            _count: e._count,
          }))}
        />
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
