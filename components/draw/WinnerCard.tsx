"use client";

import { cn } from "@/lib/utils";

interface WinnerCardProps {
  name: string;
  ticketNumber?: number;
  prizeName: string;
  visible: boolean;
}

export function WinnerCard({
  name,
  ticketNumber,
  prizeName,
  visible,
}: WinnerCardProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-2xl rounded-2xl border border-amber-100/20 bg-zinc-900/60 px-12 py-10 text-center backdrop-blur-md transition-all duration-700",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-amber-200/70">
        {prizeName}
      </p>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-amber-50 md:text-5xl">
        {name}
      </p>
      {ticketNumber !== undefined && (
        <p className="mt-3 text-base text-zinc-400">Ticket #{ticketNumber}</p>
      )}
    </div>
  );
}
