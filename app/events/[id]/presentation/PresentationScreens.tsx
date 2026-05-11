"use client";

import { cn } from "@/lib/utils";

export interface PresentationPrize {
  id: string;
  name: string;
  description: string | null;
  order: number;
  locked: boolean;
  winner: {
    entryId: string;
    ticketNumber: number;
    displayName: string;
  } | null;
}

const ACCENT_TEXT_STYLE = {
  color: "color-mix(in oklch, var(--celebration) 65%, white)",
};

const ACCENT_RING_STYLE = {
  boxShadow:
    "inset 0 0 0 1px color-mix(in oklch, var(--celebration) 18%, transparent)",
};

/** Small mono subtitle shown beneath headlines on between-draw screens.
    Builds momentum by showing the audience the scale of what they're part of. */
function EntryCountStat({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p className="mt-3 text-base text-zinc-400 md:text-lg">
      <span className="font-mono tabular-nums text-zinc-200">
        {count.toLocaleString()}
      </span>{" "}
      {count === 1 ? "ticket" : "tickets"} in the draw
    </p>
  );
}

export function TestWatermark() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span
        className="rotate-[-12deg] text-[20vw] font-bold uppercase tracking-[0.2em] select-none"
        style={{
          color: "color-mix(in oklch, var(--celebration) 8%, transparent)",
        }}
      >
        Test
      </span>
    </div>
  );
}

interface PreparingProps {
  drawMode: "PRIZE_DRAW" | "WINNER_DRAW";
  prizeName: string | null;
  isTest: boolean;
}

export function PreparingScreen({
  drawMode,
  prizeName,
  isTest,
}: PreparingProps) {
  return (
    <div className="relative flex h-full min-h-screen w-full flex-col items-center justify-center gap-8 p-12 text-center text-zinc-100">
      {isTest && <TestWatermark />}
      {prizeName && (
        <div
          className="text-base font-medium uppercase tracking-[0.3em] md:text-lg"
          style={ACCENT_TEXT_STYLE}
        >
          {prizeName}
        </div>
      )}
      <div className="text-display-md font-semibold tracking-tight md:text-display-xl">
        {drawMode === "WINNER_DRAW" ? "Drawing next winner…" : "Drawing winner…"}
      </div>
    </div>
  );
}

interface AllDrawnProps {
  eventName: string;
  prizes: PresentationPrize[];
  entryCount: number;
}

export function AllDrawnScreen({
  eventName,
  prizes,
  entryCount,
}: AllDrawnProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-12 p-12 text-zinc-100">
      <div className="text-center">
        <div
          className="text-base font-medium uppercase tracking-[0.3em] md:text-lg"
          style={ACCENT_TEXT_STYLE}
        >
          {eventName}
        </div>
        <div className="mt-4 text-display-lg font-semibold tracking-tight md:text-display-2xl">
          Drawing complete
        </div>
        <div className="mt-3 text-base text-zinc-400 md:text-lg">
          <span className="font-mono tabular-nums">{prizes.length}</span>{" "}
          {prizes.length === 1 ? "winner" : "winners"} locked in
          {entryCount > 0 && (
            <>
              {" "}
              from{" "}
              <span className="font-mono tabular-nums">
                {entryCount.toLocaleString()}
              </span>{" "}
              {entryCount === 1 ? "ticket" : "tickets"}
            </>
          )}
        </div>
      </div>

      <ul className="w-full max-w-4xl space-y-8">
        {prizes.map((p) => (
          <li key={p.id} className="text-center">
            <div
              className="text-sm font-medium uppercase tracking-[0.3em] md:text-base"
              style={ACCENT_TEXT_STYLE}
            >
              {p.name}
            </div>
            <div
              className="mt-2 text-display-sm font-semibold tracking-tight text-zinc-50 md:text-display-md"
              style={
                p.winner
                  ? {
                      textShadow:
                        "0 0 60px color-mix(in oklch, var(--celebration) 30%, transparent)",
                    }
                  : undefined
              }
            >
              {p.winner?.displayName ?? "—"}
            </div>
            {p.winner && (
              <div className="mt-2 font-mono text-sm tabular-nums text-zinc-500">
                Ticket #{p.winner.ticketNumber}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface TeaserProps {
  eventName: string;
  prizes: PresentationPrize[];
  entryCount: number;
}

export function WinnerDrawTeaserScreen({
  eventName,
  prizes,
  entryCount,
}: TeaserProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-12 p-12 text-zinc-100">
      <div className="text-center">
        <div
          className="text-base font-medium uppercase tracking-[0.3em] md:text-lg"
          style={ACCENT_TEXT_STYLE}
        >
          {eventName}
        </div>
        <div className="mt-4 text-display-lg font-semibold tracking-tight md:text-display-2xl">
          Tonight&rsquo;s prizes
        </div>
        <div className="mt-3 text-base text-zinc-400 md:text-lg">
          <span className="font-mono tabular-nums">{prizes.length}</span>{" "}
          {prizes.length === 1 ? "prize" : "prizes"} up for grabs
          {entryCount > 0 && (
            <>
              {" · "}
              <span className="font-mono tabular-nums">
                {entryCount.toLocaleString()}
              </span>{" "}
              {entryCount === 1 ? "ticket" : "tickets"} in the draw
            </>
          )}
        </div>
      </div>

      <ul className="grid w-full max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
        {prizes.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl bg-zinc-900/60 px-6 py-6 text-center backdrop-blur-md"
            style={ACCENT_RING_STYLE}
          >
            <p className="text-xl font-semibold text-zinc-50 md:text-2xl">
              {p.name}
            </p>
            {p.description && (
              <p className="mt-2 line-clamp-2 text-sm text-zinc-400 md:text-base">
                {p.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ParkedWinnerLite {
  entryId: string;
  ticketNumber: number;
  displayName: string;
}

interface IdleProps {
  drawMode: "PRIZE_DRAW" | "WINNER_DRAW";
  eventName: string;
  prizes: PresentationPrize[] | null;
  parkedWinners: ParkedWinnerLite[];
  entryCount: number;
}

export function IdleScreen({
  drawMode,
  eventName,
  prizes,
  parkedWinners,
  entryCount,
}: IdleProps) {
  // For WINNER_DRAW, build a unified "winners so far" list by merging locked
  // prize-winners (have a prize) with parked entries (prize pending). Order:
  // locked first (prize chosen), then parked (audience saw the reveal but
  // operator deferred the prize selection).
  const winnersSoFar =
    drawMode === "WINNER_DRAW"
      ? [
          ...(prizes ?? [])
            .filter((p) => p.locked && p.winner)
            .map((p) => ({
              entryId: p.winner!.entryId,
              ticketNumber: p.winner!.ticketNumber,
              displayName: p.winner!.displayName,
              prizeName: p.name as string | null,
            })),
          ...parkedWinners.map((w) => ({
            entryId: w.entryId,
            ticketNumber: w.ticketNumber,
            displayName: w.displayName,
            prizeName: null,
          })),
        ]
      : [];

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-12 p-12 text-zinc-100">
      <div className="text-center">
        <div
          className="text-base font-medium uppercase tracking-[0.3em] md:text-lg"
          style={ACCENT_TEXT_STYLE}
        >
          {eventName}
        </div>
        <div className="mt-4 text-display-lg font-semibold tracking-tight md:text-display-2xl">
          {drawMode === "WINNER_DRAW"
            ? "Awaiting next winner"
            : "Awaiting next draw"}
        </div>
        <EntryCountStat count={entryCount} />
      </div>

      {drawMode === "PRIZE_DRAW" && prizes && prizes.length > 0 && (
        <ul className="w-full max-w-3xl space-y-1">
          {prizes.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-6 border-b border-zinc-800/80 py-4 last:border-0"
            >
              <span
                className={cn(
                  "text-xl md:text-2xl",
                  p.locked ? "text-zinc-500 line-through" : "text-zinc-100",
                )}
              >
                {p.name}
              </span>
              {p.winner && (
                <span
                  className="shrink-0 text-base md:text-lg"
                  style={ACCENT_TEXT_STYLE}
                >
                  {p.winner.displayName}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {drawMode === "WINNER_DRAW" && winnersSoFar.length > 0 && (
        <div className="w-full max-w-3xl space-y-4">
          <div
            className="text-center text-sm font-medium uppercase tracking-[0.3em]"
            style={ACCENT_TEXT_STYLE}
          >
            Winners so far
          </div>
          <ul className="space-y-1">
            {winnersSoFar.map((w) => (
              <li
                key={w.entryId}
                className="flex items-center justify-between gap-6 border-b border-zinc-800/80 py-3 last:border-0"
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-xl text-zinc-100 md:text-2xl">
                    {w.displayName}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-zinc-500">
                    #{w.ticketNumber}
                  </span>
                </div>
                <span
                  className="shrink-0 text-sm md:text-base"
                  style={
                    w.prizeName
                      ? ACCENT_TEXT_STYLE
                      : { color: "var(--zinc-500)" }
                  }
                >
                  {w.prizeName ?? (
                    <span className="text-zinc-500">Prize pending</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
