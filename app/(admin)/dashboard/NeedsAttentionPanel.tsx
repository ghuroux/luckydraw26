import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";

import { StatusBadge } from "@/components/shell";

export interface ParkedWinnerItem {
  entryId: string;
  ticketNumber: number;
  entrantName: string;
  wonAt: Date;
  eventId: string;
  eventName: string;
}

export interface DraftReadyItem {
  id: string;
  name: string;
  date: Date | null;
  prizeCount: number;
  entryCount: number;
}

interface Props {
  parkedWinners: ParkedWinnerItem[];
  draftsReady: DraftReadyItem[];
}

/**
 * "Needs attention" — actionable items the admin should resolve. Renders
 * nothing when both lists are empty so the panel is a real signal, not
 * persistent chrome. Each item has a direct action link.
 */
export function NeedsAttentionPanel({ parkedWinners, draftsReady }: Props) {
  if (parkedWinners.length === 0 && draftsReady.length === 0) return null;

  return (
    <section
      className="space-y-4 rounded-2xl px-5 py-5 ring-1 ring-inset"
      style={{
        backgroundColor:
          "color-mix(in oklch, var(--celebration-soft) 45%, transparent)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in oklch, var(--celebration) 22%, transparent)",
      }}
    >
      <div className="flex items-center gap-2">
        <AlertCircle
          className="size-4"
          style={{ color: "var(--celebration-foreground)" }}
        />
        <h2
          className="text-xs font-medium uppercase tracking-[0.18em]"
          style={{ color: "var(--celebration-foreground)" }}
        >
          Needs attention
        </h2>
      </div>

      {parkedWinners.length > 0 && (
        <AttentionGroup
          title="Parked winners"
          count={parkedWinners.length}
          description="Winners are drawn but waiting for a prize to be assigned."
        >
          {parkedWinners.map((p) => (
            <AttentionRow
              key={p.entryId}
              primary={p.entrantName}
              secondary={
                <>
                  {p.eventName} · ticket{" "}
                  <span className="font-mono tabular-nums">
                    #{p.ticketNumber}
                  </span>{" "}
                  · parked{" "}
                  <span className="font-mono tabular-nums">
                    {new Date(p.wonAt).toLocaleTimeString("en-ZA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </>
              }
              actionLabel="Assign prize"
              actionHref={`/events/${p.eventId}/draw`}
            />
          ))}
        </AttentionGroup>
      )}

      {draftsReady.length > 0 && (
        <AttentionGroup
          title="Drafts ready to open"
          count={draftsReady.length}
          description="Events have prizes but aren't accepting entries yet."
        >
          {draftsReady.map((d) => (
            <AttentionRow
              key={d.id}
              primary={d.name}
              secondary={
                <>
                  <span className="font-mono tabular-nums">{d.prizeCount}</span>{" "}
                  {d.prizeCount === 1 ? "prize" : "prizes"}
                  {d.date && (
                    <>
                      {" · "}
                      {new Date(d.date).toLocaleDateString("en-ZA", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </>
                  )}
                </>
              }
              actionLabel="Open event"
              actionHref={`/events/${d.id}`}
            />
          ))}
        </AttentionGroup>
      )}
    </section>
  );
}

function AttentionGroup({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count: number;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <StatusBadge tone="warning">{count}</StatusBadge>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function AttentionRow({
  primary,
  secondary,
  actionLabel,
  actionHref,
}: {
  primary: string;
  secondary: React.ReactNode;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card/80 px-3.5 py-2.5 ring-1 ring-foreground/8">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{primary}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{secondary}</p>
      </div>
      <Link
        href={actionHref}
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {actionLabel}
        <ArrowRight className="size-3.5" />
      </Link>
    </li>
  );
}
