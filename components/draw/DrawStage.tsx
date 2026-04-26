"use client";

import { useState } from "react";
import { ConfettiLayer } from "./ConfettiLayer";
import { NameReel } from "./NameReel";
import { WinnerCard } from "./WinnerCard";

interface DrawStageProps {
  pool: string[];
  winnerName: string;
  winnerTicket?: number;
  prizeName: string;
  onComplete?: () => void;
}

export function DrawStage({
  pool,
  winnerName,
  winnerTicket,
  prizeName,
  onComplete,
}: DrawStageProps) {
  const [landed, setLanded] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  const handleLanded = () => {
    if (landed) return;
    setLanded(true);
    setConfettiKey((k) => k + 1);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-8 py-12 text-zinc-100">
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

      <ConfettiLayer triggerKey={confettiKey} />

      {landed && onComplete && (
        <button
          onClick={onComplete}
          className="mt-10 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
