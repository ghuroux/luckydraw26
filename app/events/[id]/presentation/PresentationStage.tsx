"use client";

import { useEffect, useState } from "react";
import { DrawStage } from "@/components/draw/DrawStage";
import {
  AllDrawnScreen,
  IdleScreen,
  PreparingScreen,
  WinnerDrawTeaserScreen,
  type PresentationPrize,
} from "./PresentationScreens";
import { SupporterIntroScreen } from "./SupporterIntroScreen";

interface PresentationStageProps {
  eventId: string;
  eventName: string;
  drawMode: "PRIZE_DRAW" | "WINNER_DRAW";
  prizeNameById: Record<string, string>;
}

interface Selection {
  winnerEntryId: string;
  winnerEntrantId: string;
  winnerDisplayName: string;
  winnerTicketNumber: number;
  pool: string[];
  eligibilityReset: boolean;
}

type Phase =
  | { kind: "idle" }
  | { kind: "preparing"; prizeId?: string; isTest: boolean }
  | {
      kind: "revealing";
      prizeId?: string;
      isTest: boolean;
      selection: Selection;
      selectedPrize: { id: string; name: string } | null;
    };

export interface ParkedWinner {
  entryId: string;
  ticketNumber: number;
  displayName: string;
}

export interface SupporterEntry {
  name: string;
  ticketCount: number | null;
}

interface SnapshotResponse {
  prizes: PresentationPrize[];
  parkedCount: number;
  parkedWinners: ParkedWinner[];
  entryCount: number;
  supporterCount: number;
  totalRevenue: number;
  showSupporterIntro: boolean;
  showSupporterNames: boolean;
  showSupporterTicketCounts: boolean;
  presentationStartedAt: string | null;
  supporters: SupporterEntry[];
}

export function PresentationStage({
  eventId,
  eventName,
  drawMode,
  prizeNameById,
}: PresentationStageProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [revealKey, setRevealKey] = useState(0);
  const [prizes, setPrizes] = useState<PresentationPrize[] | null>(null);
  const [parkedCount, setParkedCount] = useState(0);
  const [parkedWinners, setParkedWinners] = useState<ParkedWinner[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [supporterCount, setSupporterCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [showSupporterIntro, setShowSupporterIntro] = useState(false);
  const [showSupporterNames, setShowSupporterNames] = useState(false);
  const [presentationAdvanced, setPresentationAdvanced] = useState(false);
  const [supporters, setSupporters] = useState<SupporterEntry[]>([]);
  const [firstDrawObserved, setFirstDrawObserved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const refreshSnapshot = () => {
      fetch(`/api/events/${eventId}/draw-snapshot`, {
        signal: controller.signal,
      })
        .then((r) => r.json() as Promise<SnapshotResponse>)
        .then((data) => {
          setPrizes(data.prizes);
          setParkedCount(data.parkedCount);
          setParkedWinners(data.parkedWinners);
          setEntryCount(data.entryCount);
          setSupporterCount(data.supporterCount);
          setTotalRevenue(data.totalRevenue);
          setShowSupporterIntro(data.showSupporterIntro);
          setShowSupporterNames(data.showSupporterNames);
          setSupporters(data.supporters);
          if (data.presentationStartedAt) {
            setPresentationAdvanced(true);
          }
          if (data.prizes.some((p) => p.locked) || data.parkedCount > 0) {
            setFirstDrawObserved(true);
          }
        })
        .catch(() => {
          // Best-effort. Falling back to a bare idle state is acceptable.
        });
    };

    refreshSnapshot();

    const es = new EventSource(`/api/events/${eventId}/stream`);

    const onStarted = (isTest: boolean) => (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { prizeId?: string };
      setFirstDrawObserved(true);
      setPhase({ kind: "preparing", prizeId: data.prizeId, isTest });
    };

    const onRevealed = (isTest: boolean) => (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { prizeId?: string } & Selection;
      setRevealKey((k) => k + 1);
      setPhase({
        kind: "revealing",
        prizeId: data.prizeId,
        isTest,
        selection: {
          winnerEntryId: data.winnerEntryId,
          winnerEntrantId: data.winnerEntrantId,
          winnerDisplayName: data.winnerDisplayName,
          winnerTicketNumber: data.winnerTicketNumber,
          pool: data.pool,
          eligibilityReset: data.eligibilityReset,
        },
        selectedPrize: null,
      });
    };

    const onPrizeSelected = (e: MessageEvent) => {
      const data = JSON.parse(e.data) as {
        entryId: string;
        prizeId: string;
        prizeName: string;
      };
      setPhase((prev) => {
        if (prev.kind !== "revealing") return prev;
        if (prev.selection.winnerEntryId !== data.entryId) return prev;
        return {
          ...prev,
          selectedPrize: { id: data.prizeId, name: data.prizeName },
        };
      });
    };

    const onAborted = () => {
      // Bridge the gap between the operator clicking "Re-spin" and the
      // follow-up draw_started arriving. preparing without a prizeId reads as
      // "Drawing again…" without surfacing the abandoned name.
      setPhase({ kind: "preparing", prizeId: undefined, isTest: false });
    };

    const onParked = (e: MessageEvent) => {
      // Operator deferred prize selection. The reveal still counts toward the
      // progress chip + winners-so-far list (audience saw it), so increment
      // parkedCount locally for instant feedback, then refetch snapshot to
      // get the parked winner's name + ticket for the between-draws list.
      const data = JSON.parse(e.data) as { entryId: string };
      setParkedCount((c) => c + 1);
      setPhase((prev) => {
        if (
          prev.kind === "revealing" &&
          prev.selection.winnerEntryId === data.entryId
        ) {
          return { kind: "idle" };
        }
        return prev;
      });
      refreshSnapshot();
    };

    const onLocked = () => {
      refreshSnapshot();
    };

    const onCleared = (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { prizeId: string };
      refreshSnapshot();
      setPhase((prev) => {
        if (prev.kind === "idle") return prev;
        if (prev.kind === "revealing" && prev.prizeId === data.prizeId) {
          return { kind: "idle" };
        }
        if (prev.kind === "preparing" && prev.prizeId === data.prizeId) {
          return { kind: "idle" };
        }
        return prev;
      });
    };

    const liveStart = onStarted(false);
    const liveReveal = onRevealed(false);
    const testStart = onStarted(true);
    const testReveal = onRevealed(true);

    const onAdvance = () => {
      // Operator dismissed the supporter intro. Flip locally — server-side
      // presentationStartedAt has already been set; the next snapshot would
      // also catch this, but doing it client-side avoids a round-trip lag.
      setPresentationAdvanced(true);
    };

    es.addEventListener("draw_started", liveStart);
    es.addEventListener("draw_winner_revealed", liveReveal);
    es.addEventListener("draw_test_started", testStart);
    es.addEventListener("draw_test_winner_revealed", testReveal);
    es.addEventListener("prize_selected", onPrizeSelected);
    es.addEventListener("draw_aborted", onAborted);
    es.addEventListener("winner_parked", onParked);
    es.addEventListener("winner_locked", onLocked);
    es.addEventListener("winner_cleared", onCleared);
    es.addEventListener("presentation_advance", onAdvance);

    return () => {
      controller.abort();
      es.close();
    };
  }, [eventId]);

  const allDrawn =
    prizes !== null && prizes.length > 0 && prizes.every((p) => p.locked);

  // Progress chip overlay for WINNER_DRAW. Counts from locked prizes only —
  // parked winners are intentionally invisible from the audience POV (the
  // moment was deferred), so the chip reflects what the audience has actually
  // seen complete. Shown during preparing + revealing.
  const showProgressChip =
    drawMode === "WINNER_DRAW" &&
    (phase.kind === "preparing" || phase.kind === "revealing") &&
    !(phase.kind === "revealing" && phase.isTest) &&
    !(phase.kind === "preparing" && phase.isTest) &&
    prizes !== null &&
    prizes.length > 0;
  // Reveals the audience has seen so far = locked prizes + parked entries.
  // Both represent moments where a name landed on stage.
  const lockedCount = prizes?.filter((p) => p.locked).length ?? 0;
  const revealsCompleted = lockedCount + parkedCount;
  const progressChip = showProgressChip ? (
    <div
      className="pointer-events-none fixed left-1/2 top-8 z-30 -translate-x-1/2 rounded-full bg-zinc-900/70 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] backdrop-blur-md"
      style={{
        color: "color-mix(in oklch, var(--celebration) 70%, white)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in oklch, var(--celebration) 25%, transparent)",
      }}
    >
      Winner{" "}
      <span className="tabular-nums">
        {revealsCompleted + 1} of {prizes!.length}
      </span>
    </div>
  ) : null;

  // Pre-show: render the supporter intro before the audience teaser if the
  // org opted in AND the operator hasn't advanced AND no draws have happened
  // yet. Once advanced, presentationAdvanced stays true (snapshot-persisted)
  // and we fall through to the normal flow.
  if (
    showSupporterIntro &&
    !presentationAdvanced &&
    !firstDrawObserved &&
    phase.kind === "idle"
  ) {
    return (
      <SupporterIntroScreen
        eventName={eventName}
        entryCount={entryCount}
        supporterCount={supporterCount}
        totalRevenue={totalRevenue}
        showNames={showSupporterNames}
        supporters={supporters}
      />
    );
  }

  if (phase.kind === "revealing") {
    // PRIZE_DRAW knows the prize from the start (event payload included prizeId).
    // WINNER_DRAW only knows it once prize_selected arrives; until then the
    // prize caption is hidden (handled by DrawStage when prizeName is undefined).
    const prizeName =
      drawMode === "WINNER_DRAW"
        ? phase.selectedPrize?.name
        : phase.prizeId
          ? (prizeNameById[phase.prizeId] ?? "Prize")
          : undefined;
    return (
      <>
        <DrawStage
          key={revealKey}
          pool={phase.selection.pool}
          winnerName={phase.selection.winnerDisplayName}
          winnerTicket={phase.selection.winnerTicketNumber}
          prizeName={prizeName}
          isTest={phase.isTest}
        />
        {progressChip}
      </>
    );
  }

  if (phase.kind === "preparing") {
    const prizeName =
      drawMode === "PRIZE_DRAW" && phase.prizeId
        ? (prizeNameById[phase.prizeId] ?? "Prize")
        : null;
    return (
      <>
        <PreparingScreen
          drawMode={drawMode}
          prizeName={prizeName}
          isTest={phase.isTest}
        />
        {progressChip}
      </>
    );
  }

  if (allDrawn && prizes) {
    return (
      <AllDrawnScreen
        eventName={eventName}
        prizes={prizes}
        entryCount={entryCount}
      />
    );
  }

  if (
    drawMode === "WINNER_DRAW" &&
    !firstDrawObserved &&
    prizes &&
    prizes.length > 0
  ) {
    return (
      <WinnerDrawTeaserScreen
        eventName={eventName}
        prizes={prizes}
        entryCount={entryCount}
      />
    );
  }

  return (
    <IdleScreen
      drawMode={drawMode}
      eventName={eventName}
      prizes={prizes}
      parkedWinners={parkedWinners}
      entryCount={entryCount}
    />
  );
}
