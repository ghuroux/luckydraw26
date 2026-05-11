"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/settings/organisation", label: "Organisation" },
  { href: "/settings/users", label: "Users" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="flex gap-1 border-b border-border text-sm"
      aria-label="Settings sections"
    >
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative px-3 pb-3 pt-1 font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
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
