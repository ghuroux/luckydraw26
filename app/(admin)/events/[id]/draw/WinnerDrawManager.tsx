"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shell";
import { OperatorReveal } from "@/components/draw/OperatorReveal";
import {
  OperatorPrizePicker,
  type PrizeForOperatorPicker,
} from "@/components/draw/OperatorPrizePicker";
import {
  abortPendingDraw,
  clearWinner,
  drawNextWinner,
  parkPendingWinner,
  selectPrizeForWinner,
  sendWinnerEmail,
  type DrawSelection,
} from "@/lib/actions/draw";
import { AssignPrizeDialog } from "./AssignPrizeDialog";
import { AwardConfirmDialog } from "./AwardConfirmDialog";
import { ParkConfirmDialog } from "./ParkConfirmDialog";

export interface PrizeForWinnerDraw {
  id: string;
  name: string;
  description: string | null;
  lockedAt: Date | null;
  winningEntry: {
    id: string;
    ticketNumber: number;
    entrant: { firstName: string; lastName: string };
  } | null;
}

export interface ParkedWinner {
  entryId: string;
  ticketNumber: number;
  entrantDisplayName: string;
  wonAt: Date;
}

interface ActiveDraw {
  attempt: number;
  selection: DrawSelection;
  awarded: { id: string; name: string } | null;
}

interface Props {
  eventId: string;
  prizes: PrizeForWinnerDraw[];
  parkedWinners: ParkedWinner[];
  canDraw: boolean;
}

export function WinnerDrawManager({
  eventId,
  prizes,
  parkedWinners,
  canDraw,
}: Props) {
  const router = useRouter();
  const [active, setActive] = useState<ActiveDraw | null>(null);
  const [drawPending, setDrawPending] = useState(false);
  const [pendingPick, setPendingPick] = useState<PrizeForOperatorPicker | null>(
    null,
  );
  const [confirmPending, setConfirmPending] = useState(false);
  const [pendingPark, setPendingPark] = useState(false);
  const [parkPending, setParkPending] = useState(false);
  const [pendingAssign, setPendingAssign] = useState<ParkedWinner | null>(null);
  const [assignPending, setAssignPending] = useState(false);
  const [pendingClearId, setPendingClearId] = useState<string | null>(null);
  const [pendingEmailId, setPendingEmailId] = useState<string | null>(null);

  const remainingPrizes: PrizeForOperatorPicker[] = prizes
    .filter((p) => !p.lockedAt)
    .map((p) => ({ id: p.id, name: p.name, description: p.description }));
  const totalSlots = prizes.length;
  const lockedCount = prizes.filter((p) => p.lockedAt).length;
  const parkedCount = parkedWinners.length;
  const slotsAccountedFor = lockedCount + parkedCount;
  const nextSlotIndex = slotsAccountedFor + 1;
  const allDrawn = remainingPrizes.length === 0 && parkedCount === 0;

  async function handleDrawNext() {
    setDrawPending(true);
    const result = await drawNextWinner({ eventId });
    setDrawPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setActive({
      attempt: active ? active.attempt + 1 : 0,
      selection: result.data!,
      awarded: null,
    });
  }

  async function handleRespin() {
    if (!active || active.awarded) return;
    const abandoned = active.selection.winnerEntryId;
    setDrawPending(true);
    const abortResult = await abortPendingDraw({
      eventId,
      abortedEntryId: abandoned,
    });
    if (!abortResult.ok) {
      setDrawPending(false);
      toast.error(abortResult.error);
      return;
    }
    const drawResult = await drawNextWinner({ eventId });
    setDrawPending(false);
    if (!drawResult.ok) {
      toast.error(drawResult.error);
      return;
    }
    setActive({
      attempt: active.attempt + 1,
      selection: drawResult.data!,
      awarded: null,
    });
  }

  async function handleConfirmAward() {
    if (!active || !pendingPick) return;
    setConfirmPending(true);
    const result = await selectPrizeForWinner({
      eventId,
      prizeId: pendingPick.id,
      entryId: active.selection.winnerEntryId,
    });
    setConfirmPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const awarded = { id: pendingPick.id, name: pendingPick.name };
    setActive({ ...active, awarded });
    setPendingPick(null);
    router.refresh();
  }

  async function handleConfirmPark() {
    if (!active) return;
    setParkPending(true);
    const result = await parkPendingWinner({
      eventId,
      entryId: active.selection.winnerEntryId,
    });
    setParkPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Winner parked — assign a prize from the list when ready.");
    setPendingPark(false);
    setActive(null);
    router.refresh();
  }

  async function handleAssignPick(prize: PrizeForOperatorPicker) {
    if (!pendingAssign) return;
    setAssignPending(true);
    const result = await selectPrizeForWinner({
      eventId,
      prizeId: prize.id,
      entryId: pendingAssign.entryId,
    });
    setAssignPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${prize.name} awarded to ${pendingAssign.entrantDisplayName}`);
    setPendingAssign(null);
    router.refresh();
  }

  function handleDismiss() {
    setActive(null);
  }

  async function handleClear(prize: PrizeForWinnerDraw) {
    if (
      !window.confirm(
        `Clear the locked winner for "${prize.name}"? The prize will become unlocked and you can draw again.`,
      )
    ) {
      return;
    }
    setPendingClearId(prize.id);
    const result = await clearWinner(prize.id);
    setPendingClearId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Winner cleared");
    router.refresh();
  }

  async function sendEmail(prize: PrizeForWinnerDraw) {
    setPendingEmailId(prize.id);
    const result = await sendWinnerEmail(prize.id);
    setPendingEmailId(null);
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
          prizeName={active.awarded?.name}
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
                All entrants have already won — eligibility reset for this draw.
              </div>
            ) : null
          }
        >
          {(revealComplete) => {
            const busy = drawPending || parkPending;
            if (active.awarded) {
              return (
                <div className="flex flex-wrap items-center gap-2">
                  {remainingPrizes.length > 0 ? (
                    <Button
                      onClick={handleDrawNext}
                      disabled={drawPending || !revealComplete}
                    >
                      {drawPending ? "Drawing…" : "Draw next winner"}
                    </Button>
                  ) : (
                    <Button onClick={handleDismiss} disabled={!revealComplete}>
                      Done
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={handleDismiss}
                    disabled={!revealComplete}
                  >
                    Dismiss
                  </Button>
                </div>
              );
            }
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Tap the prize{" "}
                  <span className="font-medium text-foreground">
                    {active.selection.winnerDisplayName}
                  </span>{" "}
                  chose at the stage.
                </p>
                <OperatorPrizePicker
                  prizes={remainingPrizes}
                  onPick={(p) => setPendingPick(p)}
                  disabled={busy || !revealComplete}
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    variant="ghost"
                    onClick={handleRespin}
                    disabled={busy || !revealComplete}
                  >
                    Re-spin (winner not present)
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPendingPark(true)}
                    disabled={busy || !revealComplete}
                  >
                    Defer prize (decide later)
                  </Button>
                </div>
              </div>
            );
          }}
        </OperatorReveal>
      )}

      {!active && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {allDrawn
                ? "Draw complete"
                : `Drawing winner ${nextSlotIndex} of ${totalSlots}`}
            </p>
            <p className="mt-1 text-base">
              {allDrawn
                ? "Every prize has been awarded."
                : "Draw the next winner — they'll choose their prize at the stage."}
            </p>
          </div>
          {!allDrawn && canDraw && remainingPrizes.length > 0 && (
            <Button onClick={handleDrawNext} disabled={drawPending} size="lg">
              {drawPending ? "Drawing…" : "Draw next winner"}
            </Button>
          )}
        </div>
      )}

      {parkedWinners.length > 0 && (
        <div
          className="rounded-xl px-5 py-4 ring-1 ring-inset"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--celebration-soft) 50%, transparent)",
            boxShadow:
              "inset 0 0 0 1px color-mix(in oklch, var(--celebration) 18%, transparent)",
          }}
        >
          <p
            className="text-xs font-medium uppercase tracking-[0.2em]"
            style={{ color: "var(--celebration-foreground)" }}
          >
            Pending prize allocation ·{" "}
            <span className="font-mono tabular-nums">
              {parkedWinners.length}
            </span>
          </p>
          <ul className="mt-3 divide-y divide-foreground/8">
            {parkedWinners.map((w) => (
              <li
                key={w.entryId}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{w.entrantDisplayName}</p>
                  <p className="text-sm text-muted-foreground">
                    Ticket{" "}
                    <span className="font-mono tabular-nums">
                      #{w.ticketNumber}
                    </span>{" "}
                    · parked{" "}
                    <span className="font-mono tabular-nums">
                      {new Date(w.wonAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setPendingAssign(w)}
                  disabled={remainingPrizes.length === 0}
                >
                  {remainingPrizes.length === 0
                    ? "No prizes left"
                    : "Assign prize"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-3">
        {prizes.map((p) => {
          const winner = p.winningEntry;
          const locked = Boolean(p.lockedAt);
          const pending =
            pendingClearId === p.id || pendingEmailId === p.id;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/8"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {locked ? (
                    <StatusBadge tone="success" dot>
                      Awarded
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="muted">Available</StatusBadge>
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
                    Not yet awarded.
                  </p>
                )}
              </div>
              {locked && (
                <div className="flex shrink-0 gap-2">
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
                    onClick={() => handleClear(p)}
                    disabled={pending}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <AwardConfirmDialog
        pick={pendingPick}
        winnerName={active?.selection.winnerDisplayName ?? ""}
        pending={confirmPending}
        onCancel={() => setPendingPick(null)}
        onConfirm={handleConfirmAward}
      />

      <ParkConfirmDialog
        open={pendingPark}
        winnerName={active?.selection.winnerDisplayName ?? ""}
        pending={parkPending}
        onCancel={() => setPendingPark(false)}
        onConfirm={handleConfirmPark}
      />

      <AssignPrizeDialog
        target={pendingAssign}
        prizes={remainingPrizes}
        pending={assignPending}
        onPick={handleAssignPick}
        onClose={() => setPendingAssign(null)}
      />
    </div>
  );
}
