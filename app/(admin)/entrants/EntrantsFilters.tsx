"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

interface Props {
  search: string;
}

export function EntrantsFilters({ search }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === search) return;
      const params = new URLSearchParams();
      if (searchInput) params.set("q", searchInput);
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/entrants?${qs}` : "/entrants");
      });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  return (
    <div className="flex items-center gap-3">
      <Input
        placeholder="Search by name, email, or phone…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="max-w-md"
      />
    </div>
  );
}
