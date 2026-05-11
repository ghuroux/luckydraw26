import * as React from "react";

import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "muted";

interface StatusBadgeProps {
  tone?: StatusTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const TONE_STYLES: Record<StatusTone, string> = {
  neutral:
    "bg-foreground/[0.04] text-foreground ring-foreground/10",
  info:
    "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20",
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  warning:
    "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25",
  danger:
    "bg-destructive/10 text-destructive ring-destructive/20",
  muted:
    "bg-muted text-muted-foreground ring-foreground/8",
};

const DOT_STYLES: Record<StatusTone, string> = {
  neutral: "bg-foreground/40",
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-destructive",
  muted: "bg-muted-foreground/50",
};

export function StatusBadge({
  tone = "neutral",
  children,
  dot,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium tracking-tight ring-1 ring-inset",
        TONE_STYLES[tone],
        className
      )}
    >
      {dot ? (
        <span className={cn("size-1.5 rounded-full", DOT_STYLES[tone])} />
      ) : null}
      {children}
    </span>
  );
}
