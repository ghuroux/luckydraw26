"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EntrySource } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PaidFilter = "ALL" | "PAID" | "UNPAID";

interface Props {
  eventId: string;
  paidFilter: PaidFilter;
  source: EntrySource | "ALL";
}

export function EntriesFilters({ eventId, paidFilter, source }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function pushUrl({
    paid: nextPaid,
    source: nextSource,
  }: {
    paid: PaidFilter;
    source: EntrySource | "ALL";
  }) {
    const params = new URLSearchParams();
    if (nextPaid !== "ALL") params.set("paid", nextPaid);
    if (nextSource !== "ALL") params.set("source", nextSource);
    const qs = params.toString();
    startTransition(() => {
      router.push(
        qs
          ? `/events/${eventId}/entries?${qs}`
          : `/events/${eventId}/entries`,
      );
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={paidFilter}
        onValueChange={(value) =>
          pushUrl({ paid: value as PaidFilter, source })
        }
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All payment status</SelectItem>
          <SelectItem value="PAID">Paid only</SelectItem>
          <SelectItem value="UNPAID">Unpaid only</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={source}
        onValueChange={(value) =>
          pushUrl({ paid: paidFilter, source: value as EntrySource | "ALL" })
        }
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All sources</SelectItem>
          <SelectItem value="ADMIN">Admin</SelectItem>
          <SelectItem value="TABLET">Tablet</SelectItem>
          <SelectItem value="PUBLIC">Public</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
