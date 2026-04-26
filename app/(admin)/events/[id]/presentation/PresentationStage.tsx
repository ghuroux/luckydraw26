"use client";

import { useEffect, useState } from "react";
import { DrawStage } from "@/components/draw/DrawStage";
import { cn } from "@/lib/utils";

interface PresentationStageProps {
  eventId: string;
  eventName: string;
  prizeNameById: Record<string, string>;
}

interface Selection {
  winnerEntryId: string;
  winnerEntrantId: string;
  winnerDisplayName: string;
  pool: string[];
  eligibilityReset: boolean;
}

type Phase =
  | { kind: "idle" }
  | { kind: "preparing"; prizeId: string; isTest: boolean }
  | {
      kind: "revealing";
      prizeId: string;
      isTest: boolean;
      selection: Selection;
    };

interface SnapshotPrize {
  id: string;
  name: string;
  order: number;
  locked: boolean;
  winner: { ticketNumber: number; displayName: string } | null;
}

interface SnapshotResponse {
  prizes: Array<{
    id: string;
    name: string;
    order: number;
    locked: boolean;
    winner: { ticketNumber: number; displayName: string } | null;
  }>;
}

export function PresentationStage({
  eventId,
  eventName,
  prizeNameById,
}: PresentationStageProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Monotonic counter incremented on every revealing transition. Used as the
  // DrawStage key so a new winner always remounts the stage fresh, even when
  // React batches the preceding 'preparing' state update into the same render
  // (which would otherwise hide the intermediate unmount).
  const [revealKey, setRevealKey] = useState(0);
  // Captured at mount + re-fetched on lock/clear so the idle and complete
  // copy reflects current locked state and shows the prize lineup / winners.
  const [prizes, setPrizes] = useState<SnapshotPrize[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const refreshSnapshot = () => {
      fetch(`/api/events/${eventId}/draw-snapshot`, {
        signal: controller.signal,
      })
        .then((r) => r.json() as Promise<SnapshotResponse>)
        .then((data) => setPrizes(data.prizes))
        .catch(() => {
          // Best-effort. Falling back to a bare idle state is acceptable.
        });
    };

    refreshSnapshot();

    const es = new EventSource(`/api/events/${eventId}/stream`);

    const onStarted = (isTest: boolean) => (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { prizeId: string };
      setPhase({ kind: "preparing", prizeId: data.prizeId, isTest });
    };

    const onRevealed = (isTest: boolean) => (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { prizeId: string } & Selection;
      setRevealKey((k) => k + 1);
      setPhase({
        kind: "revealing",
        prizeId: data.prizeId,
        isTest,
        selection: {
          winnerEntryId: data.winnerEntryId,
          winnerEntrantId: data.winnerEntrantId,
          winnerDisplayName: data.winnerDisplayName,
          pool: data.pool,
          eligibilityReset: data.eligibilityReset,
        },
      });
    };

    const onLocked = () => {
      refreshSnapshot();
    };

    const onCleared = (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { prizeId: string };
      refreshSnapshot();
      setPhase((prev) => {
        if (prev.kind === "idle") return prev;
        if (prev.prizeId !== data.prizeId) return prev;
        return { kind: "idle" };
      });
    };

    const liveStart = onStarted(false);
    const liveReveal = onRevealed(false);
    const testStart = onStarted(true);
    const testReveal = onRevealed(true);

    es.addEventListener("draw_started", liveStart);
    es.addEventListener("draw_winner_revealed", liveReveal);
    es.addEventListener("draw_test_started", testStart);
    es.addEventListener("draw_test_winner_revealed", testReveal);
    es.addEventListener("winner_locked", onLocked);
    es.addEventListener("winner_cleared", onCleared);

    return () => {
      controller.abort();
      es.close();
    };
  }, [eventId]);

  const allDrawn =
    prizes !== null && prizes.length > 0 && prizes.every((p) => p.locked);

  if (phase.kind === "revealing") {
    const prizeName = prizeNameById[phase.prizeId] ?? "Prize";
    return (
      <DrawStage
        key={revealKey}
        pool={phase.selection.pool}
        winnerName={phase.selection.winnerDisplayName}
        prizeName={prizeName}
        isTest={phase.isTest}
      />
    );
  }

  if (phase.kind === "preparing") {
    const prizeName = prizeNameById[phase.prizeId] ?? "Prize";
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 p-12 text-center text-zinc-100">
        {phase.isTest && <TestWatermark />}
        <div className="text-xs font-medium uppercase tracking-[0.25em] text-amber-200/70">
          {prizeName}
        </div>
        <div className="text-3xl font-semibold tracking-tight md:text-5xl">
          Drawing winner…
        </div>
      </div>
    );
  }

  if (allDrawn && prizes) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-10 p-12 text-zinc-100">
        <div className="text-center">
          <div className="text-sm font-medium uppercase tracking-[0.25em] text-amber-200/70">
            {eventName}
          </div>
          <div className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
            Drawing complete
          </div>
          <div className="mt-2 text-sm text-zinc-400">
            {prizes.length} {prizes.length === 1 ? "winner" : "winners"} locked in
          </div>
        </div>

        <ul className="w-full max-w-3xl space-y-6">
          {prizes.map((p) => (
            <li key={p.id} className="text-center">
              <div className="text-xs font-medium uppercase tracking-[0.25em] text-amber-200/70">
                {p.name}
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-amber-50 md:text-3xl">
                {p.winner?.displayName ?? "—"}
              </div>
              {p.winner && (
                <div className="mt-1 text-xs text-zinc-500">
                  Ticket #{p.winner.ticketNumber}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 p-12 text-zinc-100">
      <div className="text-center">
        <div className="text-sm font-medium uppercase tracking-[0.25em] text-amber-200/70">
          {eventName}
        </div>
        <div className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
          Awaiting next draw
        </div>
      </div>

      {prizes && prizes.length > 0 && (
        <ul className="w-full max-w-2xl space-y-3">
          {prizes.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-6 border-b border-zinc-800/80 pb-3"
            >
              <span
                className={cn(
                  "text-lg",
                  p.locked ? "text-zinc-500 line-through" : "text-zinc-100",
                )}
              >
                {p.name}
              </span>
              {p.winner && (
                <span className="shrink-0 text-sm text-amber-200/80">
                  {p.winner.displayName}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TestWatermark() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="rotate-[-12deg] text-[20vw] font-bold uppercase tracking-[0.2em] text-amber-200/[0.07] select-none">
        Test
      </span>
    </div>
  );
}
