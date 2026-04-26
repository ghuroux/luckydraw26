"use client";

import { useEffect, useState } from "react";
import { DrawStage } from "@/components/draw/DrawStage";

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
      attempt: number;
    };

export function PresentationStage({
  eventId,
  eventName,
  prizeNameById,
}: PresentationStageProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  useEffect(() => {
    const es = new EventSource(`/api/events/${eventId}/stream`);

    const onStarted = (isTest: boolean) => (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { prizeId: string };
      setPhase({ kind: "preparing", prizeId: data.prizeId, isTest });
    };

    const onRevealed = (isTest: boolean) => (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { prizeId: string } & Selection;
      setPhase((prev) => ({
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
        attempt:
          prev.kind === "revealing" && prev.prizeId === data.prizeId
            ? prev.attempt + 1
            : 0,
      }));
    };

    const onCleared = (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { prizeId: string };
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
    es.addEventListener("winner_cleared", onCleared);
    // winner_locked is intentionally a no-op — the winner card stays visible
    // for the audience after the operator confirms.

    return () => {
      es.close();
    };
  }, [eventId]);

  if (phase.kind === "revealing") {
    const prizeName = prizeNameById[phase.prizeId] ?? "Prize";
    return (
      <DrawStage
        key={`${phase.prizeId}-${phase.attempt}`}
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

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-12 text-center text-zinc-100">
      <div className="text-sm font-medium uppercase tracking-[0.25em] text-amber-200/70">
        {eventName}
      </div>
      <div className="text-4xl font-semibold tracking-tight md:text-6xl">
        Awaiting next draw
      </div>
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
