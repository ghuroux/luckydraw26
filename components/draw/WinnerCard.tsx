"use client";

import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface WinnerCardProps {
  name: string;
  ticketNumber?: number;
  prizeName?: string;
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
        "relative mx-auto w-full max-w-3xl transition-all duration-700",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      {/* Outer celebration glow — sits behind the card, soft and warm. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 50%, color-mix(in oklch, var(--celebration) 28%, transparent), transparent 70%)",
        }}
      />

      <div
        className="relative overflow-hidden rounded-3xl bg-zinc-900/70 px-12 py-12 text-center backdrop-blur-md ring-1 ring-inset"
        style={{
          boxShadow:
            "0 30px 80px -20px color-mix(in oklch, var(--celebration) 25%, transparent), 0 0 0 1px color-mix(in oklch, var(--celebration) 20%, transparent) inset",
        }}
      >
        {/* Inner top-glow gradient — a hint of warm light from above. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-12 h-40"
          style={{
            background:
              "radial-gradient(60% 100% at 50% 0%, color-mix(in oklch, var(--celebration) 18%, transparent), transparent 70%)",
          }}
        />

        {prizeName && (
          <p
            className="relative text-sm font-medium uppercase tracking-[0.3em] md:text-base"
            style={{
              color: "color-mix(in oklch, var(--celebration) 65%, white)",
            }}
          >
            {prizeName}
          </p>
        )}

        <p
          className={cn(
            "relative font-semibold tracking-tight text-zinc-50",
            "text-display-md md:text-display-xl",
            prizeName && "mt-5",
          )}
          style={{
            textShadow:
              "0 0 80px color-mix(in oklch, var(--celebration) 35%, transparent)",
          }}
        >
          {name}
        </p>

        {ticketNumber !== undefined && (
          <div className="relative mt-6 inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 ring-1 ring-inset ring-white/10">
            <Sparkles
              className="size-3.5"
              style={{ color: "var(--celebration)" }}
            />
            <span className="font-mono text-sm tabular-nums text-zinc-300">
              Ticket #{ticketNumber}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
