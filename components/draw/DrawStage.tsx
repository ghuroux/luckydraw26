"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ConfettiLayer } from "./ConfettiLayer";
import { MuteToggle } from "./MuteToggle";
import { NameReel } from "./NameReel";
import { playPhase, stopAllSounds } from "./sounds";
import { WinnerCard } from "./WinnerCard";

interface DrawStageProps {
  pool: string[];
  winnerName: string;
  winnerTicket?: number;
  prizeName?: string;
  isTest?: boolean;
  actions?: ReactNode;
}

export function DrawStage({
  pool,
  winnerName,
  winnerTicket,
  prizeName,
  isTest,
  actions,
}: DrawStageProps) {
  const [landed, setLanded] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  const handleLanded = () => {
    if (landed) return;
    setLanded(true);
    if (!isTest) setConfettiKey((k) => k + 1);
  };

  const handlePhaseChange = useCallback((phase: string) => {
    playPhase(phase as Parameters<typeof playPhase>[0]);
  }, []);

  useEffect(() => () => stopAllSounds(), []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-8 py-12 text-zinc-100">
      {/* Cinematic vignette: subtle warm pull from the centre + edge darkening. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 45%, color-mix(in oklch, var(--celebration) 6%, transparent), transparent 70%), radial-gradient(120% 80% at 50% 100%, rgba(0,0,0,0.5), transparent 60%)",
        }}
      />

      {isTest && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span
            className="rotate-[-12deg] text-[20vw] font-bold uppercase tracking-[0.2em] select-none"
            style={{
              color: "color-mix(in oklch, var(--celebration) 8%, transparent)",
            }}
          >
            Test
          </span>
        </div>
      )}

      <MuteToggle />

      {prizeName && (
        <div
          className="relative mb-10 text-sm font-medium uppercase tracking-[0.3em] md:text-base"
          style={{
            color: "color-mix(in oklch, var(--celebration) 65%, white)",
          }}
        >
          {prizeName}
        </div>
      )}

      {/* w-full is load-bearing — without it the wrapper collapses to
          intrinsic width inside the items-center flex column, and NameReel's
          strip (position:absolute) renders into a 0-wide container.

          Once the winner card lands, fade the reel back so the eye snaps to
          the card. The reel still occupies the same space (no layout jump). */}
      <div
        className={cn(
          "relative w-full transition-opacity duration-700",
          landed ? "opacity-25" : "opacity-100",
        )}
      >
        <NameReel
          pool={pool}
          winnerName={winnerName}
          onLanded={handleLanded}
          onPhaseChange={handlePhaseChange}
        />
      </div>

      <div className="relative mt-12 w-full">
        <WinnerCard
          name={winnerName}
          ticketNumber={winnerTicket}
          prizeName={prizeName}
          visible={landed}
        />
      </div>

      {!isTest && <ConfettiLayer triggerKey={confettiKey} />}

      {/* Stinger flash — fires once when landed, gated to non-test draws.
          Keyed on confettiKey so it only mounts post-landing and won't
          re-trigger on parent re-renders. */}
      {!isTest && landed && (
        <div
          key={confettiKey}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-30 animate-stinger"
          style={{ backgroundColor: "var(--celebration)" }}
        />
      )}

      {landed && actions && (
        <div className="relative mt-10 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
