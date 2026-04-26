"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EventStatus } from "@prisma/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  status: EventStatus | "ALL";
  search: string;
}

const STATUS_OPTIONS: Array<{ value: EventStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "DRAWN", label: "Drawn" },
];

export function EventsFilters({ status, search }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(search);

  // Debounce the search push so we don't navigate on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === search) return;
      pushUrl({ status, search: searchInput });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function pushUrl({
    status: nextStatus,
    search: nextSearch,
  }: {
    status: EventStatus | "ALL";
    search: string;
  }) {
    const params = new URLSearchParams();
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    if (nextSearch) params.set("q", nextSearch);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/events?${qs}` : "/events");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Search by name…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="max-w-xs"
      />
      <Select
        value={status}
        onValueChange={(value) =>
          pushUrl({ status: value as EventStatus | "ALL", search: searchInput })
        }
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
