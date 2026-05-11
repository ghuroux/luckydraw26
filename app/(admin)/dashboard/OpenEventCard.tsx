import Link from "next/link";
import {
  ArrowUpRight,
  ExternalLink,
  Play,
  Tablet,
  Ticket,
} from "lucide-react";

import { StatusBadge } from "@/components/shell";
import { formatMoney } from "@/lib/money";

interface Props {
  id: string;
  name: string;
  date: Date | null;
  drawTime: string | null;
  ticketCount: number;
  revenue: number;
  prizeCount: number;
}

/**
 * Featured card for an OPEN event on the dashboard. Headline + status,
 * three live stats (tickets / raised / draw countdown), and a row of
 * quick actions. The whole card has a subtle primary tint so it reads
 * as "live and waiting" rather than passive.
 */
export function OpenEventCard({
  id,
  name,
  date,
  drawTime,
  ticketCount,
  revenue,
  prizeCount,
}: Props) {
  const drawCountdown = formatDrawCountdown(date);
  const dateLine = formatDateLine(date, drawTime);

  return (
    <div
      className="overflow-hidden rounded-2xl bg-card shadow-xs ring-1 ring-foreground/8"
      style={{
        backgroundImage:
          "radial-gradient(80% 60% at 0% 0%, color-mix(in oklch, var(--primary) 4%, transparent), transparent 70%)",
      }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/events/${id}`}
              className="inline-flex items-center gap-1.5 truncate text-lg font-semibold tracking-tight hover:underline"
            >
              {name}
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
            <StatusBadge tone="success" dot>
              Open
            </StatusBadge>
          </div>
          {dateLine && (
            <p className="mt-1 text-sm text-muted-foreground">{dateLine}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 px-5 pb-5">
        <Stat label="Tickets sold" value={ticketCount.toLocaleString()} />
        <Stat label="Raised" value={formatMoney(revenue)} />
        <Stat
          label={drawCountdown.label}
          value={drawCountdown.value}
          accent={drawCountdown.accent}
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-foreground/8 bg-surface-sunken/60 px-5 py-3">
        <ActionLink
          href={`/events/${id}/tablet-capture`}
          target="_blank"
          icon={<Tablet className="size-4" />}
          label="Tablet capture"
          external
          primary
        />
        <ActionLink
          href={`/events/${id}/presentation`}
          target="_blank"
          icon={<Play className="size-4" />}
          label="Presentation"
          external
        />
        <ActionLink
          href={`/events/${id}/entries`}
          icon={<Ticket className="size-4" />}
          label="Entries"
        />
        {prizeCount > 0 && (
          <ActionLink
            href={`/events/${id}/draw`}
            icon={<ArrowUpRight className="size-4" />}
            label="Run draw"
          />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "celebration" | "danger";
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 font-mono text-xl font-semibold tabular-nums tracking-tight"
        style={
          accent === "celebration"
            ? { color: "color-mix(in oklch, var(--celebration) 70%, var(--foreground))" }
            : accent === "danger"
              ? { color: "var(--destructive)" }
              : undefined
        }
      >
        {value}
      </p>
    </div>
  );
}

function ActionLink({
  href,
  target,
  icon,
  label,
  external,
  primary,
}: {
  href: string;
  target?: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
  primary?: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const tone = primary
    ? "bg-primary text-primary-foreground hover:bg-primary/90"
    : "border border-border bg-background text-foreground hover:bg-muted";
  return (
    <Link
      href={href}
      target={target}
      rel={target === "_blank" ? "noopener" : undefined}
      className={`${base} ${tone}`}
    >
      {icon}
      <span>{label}</span>
      {external && <ExternalLink className="size-3 opacity-70" />}
    </Link>
  );
}

function formatDateLine(date: Date | null, drawTime: string | null): string | null {
  if (!date) return null;
  const dateStr = new Date(date).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return drawTime ? `${dateStr} · draw at ${drawTime}` : dateStr;
}

function formatDrawCountdown(date: Date | null): {
  label: string;
  value: string;
  accent?: "celebration" | "danger";
} {
  if (!date) return { label: "Draw", value: "TBD" };

  const now = new Date();
  const target = new Date(date);
  // Normalise both to midnight so "today" stays "today" all day.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const diffMs = startOfTarget.getTime() - startOfToday.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: "Draw",
      value: `${Math.abs(diffDays)}d overdue`,
      accent: "danger",
    };
  }
  if (diffDays === 0)
    return { label: "Draw", value: "Today", accent: "celebration" };
  if (diffDays === 1) return { label: "Draw", value: "Tomorrow", accent: "celebration" };
  return {
    label: "Draw in",
    value: `${diffDays} days`,
    accent: diffDays <= 7 ? "celebration" : undefined,
  };
}
