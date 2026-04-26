import Link from "next/link";
import { listEntrants } from "@/lib/actions/entrant";
import { buttonVariants } from "@/components/ui/button";
import { EntrantsFilters } from "./EntrantsFilters";
import { EntrantsTable } from "./EntrantsTable";
import { parsePageParam } from "@/lib/pagination";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
}

export default async function EntrantsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.q ?? "";
  const page = parsePageParam(params.page);

  const { entrants, pagination } = await listEntrants({ search, page });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Entrants</h1>
          <p className="mt-2 text-muted-foreground">
            {pagination.total}{" "}
            {pagination.total === 1 ? "entrant" : "entrants"}
            {search ? ` · matching “${search}”` : ""}
          </p>
        </div>
        <Link
          href="/api/entrants/export"
          className={buttonVariants({ variant: "outline" })}
          download
        >
          Export CSV
        </Link>
      </div>

      <EntrantsFilters search={search} />

      {entrants.length === 0 ? (
        <EmptyState hasFilters={!!search} />
      ) : (
        <EntrantsTable entrants={entrants} />
      )}

      {pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
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
        {hasFilters ? "No entrants match that search." : "No entrants yet."}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters
          ? "Try a different name, email, or phone."
          : "Entrants are created the first time they're added to an event."}
      </p>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  search: string;
  hasPrev: boolean;
  hasNext: boolean;
}

function Pagination({
  page,
  totalPages,
  search,
  hasPrev,
  hasNext,
}: PaginationProps) {
  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/entrants?${qs}` : "/entrants";
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
