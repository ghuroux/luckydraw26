"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <nav className="-mb-px flex gap-6 border-b text-sm">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "border-b-2 pb-3 transition " +
              (active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
