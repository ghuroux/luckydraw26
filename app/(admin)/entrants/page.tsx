import Link from "next/link";
import { Inbox } from "lucide-react";

import { listEntrants } from "@/lib/actions/entrant";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader, Pagination } from "@/components/shell";
import { parsePageParam } from "@/lib/pagination";
import { EntrantsFilters } from "./EntrantsFilters";
import { EntrantsTable } from "./EntrantsTable";

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

  const buildUrl = (p: number) => {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/entrants?${s}` : "/entrants";
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Entrants"
        description={
          <>
            <span className="font-mono tabular-nums">{pagination.total}</span>{" "}
            {pagination.total === 1 ? "entrant" : "entrants"}
            {search ? ` · matching “${search}”` : ""}
          </>
        }
        actions={
          <Link
            href="/api/entrants/export"
            className={buttonVariants({ variant: "outline" })}
            download
          >
            Export CSV
          </Link>
        }
      />

      <EntrantsFilters search={search} />

      {entrants.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title={search ? "No entrants match that search." : "No entrants yet."}
          description={
            search
              ? "Try a different name, email, or phone."
              : "Entrants are created the first time they're added to an event."
          }
        />
      ) : (
        <EntrantsTable entrants={entrants} />
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
