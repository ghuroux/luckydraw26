import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  buildUrl: (page: number) => string;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  hasPrev,
  hasNext,
  buildUrl,
  className,
}: PaginationProps) {
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex items-center justify-between text-sm text-muted-foreground",
        className
      )}
    >
      <p className="font-mono tabular-nums">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Link
          href={buildUrl(page - 1)}
          aria-disabled={!hasPrev}
          tabIndex={hasPrev ? undefined : -1}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            !hasPrev && "pointer-events-none opacity-50"
          )}
        >
          Previous
        </Link>
        <Link
          href={buildUrl(page + 1)}
          aria-disabled={!hasNext}
          tabIndex={hasNext ? undefined : -1}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            !hasNext && "pointer-events-none opacity-50"
          )}
        >
          Next
        </Link>
      </div>
    </nav>
  );
}
