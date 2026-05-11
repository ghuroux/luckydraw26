import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  trend?: {
    value: React.ReactNode;
    direction?: "up" | "down" | "neutral";
  };
  className?: string;
}

export function StatCard({ label, value, hint, href, trend, className }: StatCardProps) {
  const body = (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-display-xs font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {hint || trend ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono tabular-nums",
                trend.direction === "up" && "text-emerald-700 bg-emerald-50",
                trend.direction === "down" && "text-destructive bg-destructive/10"
              )}
            >
              {trend.value}
            </span>
          ) : null}
          {hint ? <span>{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );

  const baseClass = cn(
    "rounded-xl bg-card p-5 ring-1 ring-foreground/8 transition-all",
    href && "hover:ring-foreground/15 hover:shadow-sm",
    className
  );

  if (href) {
    return (
      <Link href={href} className={cn(baseClass, "block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
        {body}
      </Link>
    );
  }
  return <div className={baseClass}>{body}</div>;
}
