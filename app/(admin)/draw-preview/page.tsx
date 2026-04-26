"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DrawStage } from "@/components/draw/DrawStage";

const MOCK_POOL = [
  "Sarah Chen",
  "Marcus Williams",
  "Priya Patel",
  "James O'Brien",
  "Aisha Mohammed",
  "Robert Johnson",
  "Emma Thompson",
  "Wei Zhang",
  "Nadia Hassan",
  "Carlos Mendes",
];
const MOCK_WINNER_NAME = "Priya Patel";
const MOCK_PRIZE = "Grand Prize: Weekend Getaway";
const MOCK_TICKET = 142;

// THROWAWAY — Phase 2c only. Delete in 2d when the real admin draw page exists.
export default function DrawPreviewPage() {
  const [running, setRunning] = useState(false);
  const [runKey, setRunKey] = useState(0);

  if (running) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <DrawStage
          key={runKey}
          pool={MOCK_POOL}
          winnerName={MOCK_WINNER_NAME}
          winnerTicket={MOCK_TICKET}
          prizeName={MOCK_PRIZE}
          actions={
            <Button variant="outline" onClick={() => setRunning(false)}>
              Dismiss
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold">Draw animation preview</h1>
      <p className="max-w-prose text-muted-foreground">
        Throwaway preview for tuning the reveal. Mock pool of 10 entrants;
        winner is &ldquo;{MOCK_WINNER_NAME}&rdquo;. Toggle{" "}
        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">
          prefers-reduced-motion
        </kbd>{" "}
        in your OS or DevTools to verify the fallback (3-second cross-fade
        through 10 names ending on the winner; no scroll, no blur).
      </p>
      <Button
        size="lg"
        onClick={() => {
          setRunKey((k) => k + 1);
          setRunning(true);
        }}
      >
        Start mock draw
      </Button>
    </div>
  );
}
