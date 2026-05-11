"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface Props {
  eventId: string;
}

export function EventTabs({ eventId }: Props) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;

  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/entries`, label: "Entries" },
    { href: `${base}/prizes`, label: "Prizes" },
    { href: `${base}/packages`, label: "Packages" },
    { href: `${base}/draw`, label: "Draw" },
  ];

  return (
    <nav className="flex gap-1 border-b border-border text-sm" aria-label="Event sections">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative px-3 pb-3 pt-1 font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {active ? (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-foreground" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
