"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  matchPrefix?: string;
  superadminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/entrants", label: "Entrants" },
  {
    href: "/settings/organisation",
    label: "Settings",
    matchPrefix: "/settings",
    superadminOnly: true,
  },
];

interface Props {
  isSuperadmin: boolean;
}

export function AdminNav({ isSuperadmin }: Props) {
  const pathname = usePathname() ?? "";
  const items = NAV_ITEMS.filter(
    (item) => !item.superadminOnly || isSuperadmin,
  );

  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item) => {
        const matchAgainst = item.matchPrefix ?? item.href;
        const active =
          pathname === item.href || pathname.startsWith(`${matchAgainst}/`) || pathname === matchAgainst;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative rounded-md px-3 py-1.5 font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
            {active ? (
              <span className="absolute inset-x-3 -bottom-[13px] h-px bg-foreground" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
