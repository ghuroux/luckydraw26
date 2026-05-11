"use client";

import { Heart, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

const ACCENT_TEXT_STYLE = {
  color: "color-mix(in oklch, var(--celebration) 70%, white)",
};

interface Supporter {
  name: string;
  ticketCount: number | null;
}

interface Props {
  eventName: string;
  entryCount: number;
  supporterCount: number;
  totalRevenue: number;
  showNames: boolean;
  supporters: Supporter[];
}

/**
 * Pre-show. Renders before the first draw when Event.showSupporterIntro is on.
 * Sets a gratitude tone before competition begins:
 *   - Aggregate stats (tickets / supporters / raised)
 *   - Generic "Thank you" message
 *   - Optional infinite supporter-name scroller (Event.showSupporterNames).
 *     No counts, no ranking — egalitarian acknowledgment of every supporter.
 *
 * The operator advances past this screen via the "Audience is ready" button on
 * the admin draw page, which sets presentationStartedAt + publishes a
 * presentation_advance SSE event.
 */
export function SupporterIntroScreen({
  eventName,
  entryCount,
  supporterCount,
  totalRevenue,
  showNames,
  supporters,
}: Props) {
  const hasStats = entryCount > 0 || supporterCount > 0 || totalRevenue > 0;
  const showScroller = showNames && supporters.length > 0;

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-14 p-12 text-zinc-100">
      <div className="text-center">
        <div
          className="text-base font-medium uppercase tracking-[0.3em] md:text-lg"
          style={ACCENT_TEXT_STYLE}
        >
          {eventName}
        </div>
        <h1
          className="mt-5 text-display-lg font-semibold tracking-tight md:text-display-2xl"
          style={{
            textShadow:
              "0 0 80px color-mix(in oklch, var(--celebration) 25%, transparent)",
          }}
        >
          Thank you
        </h1>
        <p className="mx-auto mt-5 max-w-3xl text-base text-zinc-400 md:text-xl">
          Tonight is possible because of you. Every ticket bought is a step
          closer to something good.
        </p>
      </div>

      {hasStats && (
        <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Tickets" value={entryCount.toLocaleString()} />
          <StatTile
            label={supporterCount === 1 ? "Supporter" : "Supporters"}
            value={supporterCount.toLocaleString()}
          />
          <StatTile label="Raised" value={formatMoney(totalRevenue)} />
        </div>
      )}

      {showScroller && <SupporterScroller supporters={supporters} />}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl bg-zinc-900/60 px-6 py-7 text-center backdrop-blur-md"
      style={{
        boxShadow:
          "inset 0 0 0 1px color-mix(in oklch, var(--celebration) 18%, transparent)",
      }}
    >
      <p
        className="text-xs font-medium uppercase tracking-[0.22em]"
        style={ACCENT_TEXT_STYLE}
      >
        {label}
      </p>
      <p className="mt-3 font-mono text-display-sm font-semibold tabular-nums tracking-tight text-zinc-50 md:text-display-md">
        {value}
      </p>
    </div>
  );
}

interface ScrollerProps {
  supporters: Supporter[];
}

/**
 * Infinite vertical scroller of all supporters. List is duplicated so the
 * CSS keyframe can translateY(-50%) and loop seamlessly. Speed scales with
 * the list length so the per-name pace stays roughly constant.
 *
 * When supporters carry ticketCount (org opted into showSupporterTicketCounts),
 * each row shows the count alongside the name in muted mono — alphabetical
 * order is preserved either way to avoid implicit ranking.
 *
 * Fade masks at top and bottom keep focus on the middle and soften entry/exit.
 */
function SupporterScroller({ supporters }: ScrollerProps) {
  // Pace: ~1.4s of screen time per name. Capped 18–90s so tiny and huge
  // events both read at a comfortable speed.
  const durationSeconds = Math.min(90, Math.max(18, supporters.length * 1.4));
  const doubled = [...supporters, ...supporters];

  // When ticket counts are surfaced, rows justify between (name left, pill
  // right) for a clean ledger-style read. Without counts, names centre so the
  // empty right-hand side doesn't look unbalanced.
  const hasCounts = supporters.some((s) => s.ticketCount !== null);

  return (
    <div className="w-full max-w-2xl space-y-5">
      <div
        className="flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-[0.3em]"
        style={ACCENT_TEXT_STYLE}
      >
        <Heart
          className="size-4"
          style={{ color: "var(--celebration)" }}
          fill="currentColor"
        />
        <span>Our supporters tonight</span>
      </div>

      <div className="relative h-[40vh] overflow-hidden">
        {/* Top fade mask */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/4 bg-gradient-to-b from-zinc-950 to-transparent" />
        {/* Bottom fade mask */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/4 bg-gradient-to-t from-zinc-950 to-transparent" />

        <ul
          className="flex flex-col px-2"
          style={{
            animation: `supporter-scroll ${durationSeconds}s linear infinite`,
          }}
        >
          {doubled.map((s, i) => (
            <li
              key={i}
              className={cn(
                "flex items-center gap-6 py-2.5",
                hasCounts ? "justify-between" : "justify-center",
              )}
            >
              <span className="truncate text-xl font-medium text-zinc-100 md:text-2xl">
                {s.name}
              </span>
              {s.ticketCount !== null && (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 ring-1 ring-inset ring-white/10"
                  title={`${s.ticketCount} ${s.ticketCount === 1 ? "ticket" : "tickets"}`}
                >
                  <Sparkles
                    className="size-3.5"
                    style={{ color: "var(--celebration)" }}
                  />
                  <span className="font-mono text-sm tabular-nums text-zinc-100">
                    {s.ticketCount}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
