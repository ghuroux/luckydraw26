"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shell";
import { OperatorReveal } from "@/components/draw/OperatorReveal";
import {
  clearWinner,
  lockWinner,
  sendWinnerEmail,
  startDraw,
  testDraw,
  type DrawSelection,
} from "@/lib/actions/draw";

export interface PrizeForDraw {
  id: string;
  name: string;
  lockedAt: Date | null;
  winningEntry: {
    id: string;
    ticketNumber: number;
    entrant: { firstName: string; lastName: string };
  } | null;
}

interface ActiveDraw {
  prizeId: string;
  prizeName: string;
  isTest: boolean;
  selection: DrawSelection;
  attempt: number;
}

interface Props {
  prizes: PrizeForDraw[];
  canDraw: boolean;
}

export function PrizeDrawManager({ prizes, canDraw }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<ActiveDraw | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function runSelection(prize: PrizeForDraw, isTest: boolean) {
    setPendingId(prize.id);
    const result = await (isTest ? testDraw(prize.id) : startDraw(prize.id));
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setActive({
      prizeId: prize.id,
      prizeName: prize.name,
      isTest,
      selection: result.data!,
      attempt: 0,
    });
  }

  async function redraw() {
    if (!active) return;
    const result = await (active.isTest
      ? testDraw(active.prizeId)
      : startDraw(active.prizeId));
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setActive({
      ...active,
      selection: result.data!,
      attempt: active.attempt + 1,
    });
  }

  async function lock() {
    if (!active) return;
    const result = await lockWinner(
      active.prizeId,
      active.selection.winnerEntryId,
    );
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Winner locked in");
    setActive(null);
    router.refresh();
  }

  async function clear(prize: PrizeForDraw) {
    if (
      !window.confirm(
        `Clear the locked winner for "${prize.name}"? The prize will become unlocked and you can draw again.`,
      )
    ) {
      return;
    }
    setPendingId(prize.id);
    const result = await clearWinner(prize.id);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Winner cleared");
    router.refresh();
  }

  async function sendEmail(prize: PrizeForDraw) {
    setPendingId(prize.id);
    const result = await sendWinnerEmail(prize.id);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Winner email sent");
  }

  return (
    <div className="space-y-6">
      {active && (
        <OperatorReveal
          attempt={active.attempt}
          winnerName={active.selection.winnerDisplayName}
          winnerTicket={active.selection.winnerTicketNumber}
          prizeName={active.prizeName}
          isTest={active.isTest}
          banner={
            active.selection.eligibilityReset ? (
              <div
                className="rounded-lg px-4 py-2.5 text-sm"
                style={{
                  backgroundColor:
                    "color-mix(in oklch, var(--celebration-soft) 60%, transparent)",
                  color: "var(--celebration-foreground)",
                }}
              >
                All entrants have already won — eligibility reset for this prize.
              </div>
            ) : null
          }
        >
          {(revealComplete) => (
            <div className="flex flex-wrap items-center gap-2">
              {!active.isTest && (
                <Button onClick={lock} disabled={!revealComplete}>
                  Lock in winner
                </Button>
              )}
              <Button
                variant="outline"
                onClick={redraw}
                disabled={!revealComplete}
              >
                {active.isTest ? "Run another" : "Redraw"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setActive(null)}
                disabled={!revealComplete}
              >
                Dismiss
              </Button>
            </div>
          )}
        </OperatorReveal>
      )}

      <ul className="space-y-3">
        {prizes.map((p) => {
          const winner = p.winningEntry;
          const locked = Boolean(p.lockedAt);
          const pending = pendingId === p.id;
          const isActiveTarget = active?.prizeId === p.id;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/8"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {locked && (
                    <StatusBadge tone="success" dot>
                      Locked
                    </StatusBadge>
                  )}
                </div>
                {winner ? (
                  <p className="text-sm text-muted-foreground">
                    Winner:{" "}
                    <span className="text-foreground">
                      {winner.entrant.firstName} {winner.entrant.lastName}
                    </span>{" "}
                    ·{" "}
                    <span className="font-mono tabular-nums">
                      #{winner.ticketNumber}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No winner drawn yet.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {locked ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendEmail(p)}
                      disabled={pending}
                    >
                      Send winner email
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => clear(p)}
                      disabled={pending}
                    >
                      Clear
                    </Button>
                  </>
                ) : (
                  canDraw && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => runSelection(p, false)}
                        disabled={pending || isActiveTarget}
                      >
                        {pending ? "Picking…" : "Start draw"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runSelection(p, true)}
                        disabled={pending || isActiveTarget}
                      >
                        Test draw
                      </Button>
                    </>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
