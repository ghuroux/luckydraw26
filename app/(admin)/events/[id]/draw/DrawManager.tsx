"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DrawStage } from "@/components/draw/DrawStage";
import {
  clearWinner,
  lockWinner,
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

export function DrawManager({ prizes, canDraw }: Props) {
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

  function emailStub() {
    toast.info("Winner email — coming in Phase 4");
  }

  if (active) {
    const { selection, prizeName, isTest, attempt } = active;
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950">
        {selection.eligibilityReset && (
          <div className="absolute left-1/2 top-6 z-40 -translate-x-1/2 rounded-lg border border-amber-200/30 bg-amber-100/10 px-4 py-2 text-center text-sm text-amber-200 backdrop-blur">
            All entrants have already won — eligibility reset for this prize
          </div>
        )}
        <DrawStage
          key={attempt}
          pool={selection.pool}
          winnerName={selection.winnerDisplayName}
          prizeName={prizeName}
          isTest={isTest}
          actions={
            <>
              {!isTest && <Button onClick={lock}>Lock in winner</Button>}
              <Button variant="outline" onClick={redraw}>
                {isTest ? "Run another" : "Redraw"}
              </Button>
              <Button variant="ghost" onClick={() => setActive(null)}>
                Dismiss
              </Button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {prizes.map((p) => {
        const winner = p.winningEntry;
        const locked = Boolean(p.lockedAt);
        const pending = pendingId === p.id;
        return (
          <li
            key={p.id}
            className="flex items-center justify-between gap-4 p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                {locked && <Badge variant="secondary">Locked</Badge>}
              </div>
              {winner ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Winner:{" "}
                  <span className="text-foreground">
                    {winner.entrant.firstName} {winner.entrant.lastName}
                  </span>{" "}
                  · ticket #{winner.ticketNumber}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  No winner drawn yet.
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {locked ? (
                <>
                  <Button size="sm" variant="outline" onClick={emailStub}>
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
                      disabled={pending}
                    >
                      {pending ? "Picking…" : "Start draw"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runSelection(p, true)}
                      disabled={pending}
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
  );
}
