"use client";

import { useState, type ReactNode } from "react";
import { ConfettiLayer } from "./ConfettiLayer";
import { NameReel } from "./NameReel";
import { WinnerCard } from "./WinnerCard";

interface DrawStageProps {
  pool: string[];
  winnerName: string;
  winnerTicket?: number;
  prizeName: string;
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

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-8 py-12 text-zinc-100">
      {isTest && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span className="rotate-[-12deg] text-[20vw] font-bold uppercase tracking-[0.2em] text-amber-200/[0.07] select-none">
            Test
          </span>
        </div>
      )}

      <div className="mb-10 text-xs font-medium uppercase tracking-[0.25em] text-amber-200/70">
        {prizeName}
      </div>

      <NameReel
        pool={pool}
        winnerName={winnerName}
        onLanded={handleLanded}
      />

      <div className="mt-10 w-full">
        <WinnerCard
          name={winnerName}
          ticketNumber={winnerTicket}
          prizeName={prizeName}
          visible={landed}
        />
      </div>

      {!isTest && <ConfettiLayer triggerKey={confettiKey} />}

      {landed && actions && (
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
