"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { ConfirmationPayload } from "./PaymentStep";

const AUTO_RETURN_MS = 5000;

export function ConfirmationStep({
  payload,
  onDone,
}: {
  payload: ConfirmationPayload;
  onDone: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(AUTO_RETURN_MS / 1000),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    const timeout = setTimeout(onDone, AUTO_RETURN_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onDone]);

  const ticketRange = formatTicketRange(payload.ticketNumbers);
  const ticketCount = payload.ticketNumbers.length;

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Soft success backdrop — primary tint behind the icon */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 40% at 50% 35%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 70%)",
        }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 blur-2xl"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 50%, color-mix(in oklch, var(--primary) 30%, transparent), transparent 70%)",
            }}
          />
          <CheckCircle2 className="size-24 text-primary" aria-hidden />
        </div>

        <h2 className="mt-8 text-display-xs font-semibold tracking-tight md:text-display-sm">
          Sale captured
        </h2>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          {ticketCount === 1 ? "Ticket" : "Tickets"}{" "}
          <span className="font-mono tabular-nums text-foreground">
            {ticketRange}
          </span>{" "}
          for{" "}
          <span className="font-medium text-foreground">
            {payload.entrantFirstName} {payload.entrantLastName}
          </span>
          .
        </p>
        <div className="mt-4 flex items-center gap-3 text-base">
          <span className="font-mono tabular-nums text-foreground">
            {formatMoney(payload.total)}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {payload.paymentMethod}
          </span>
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          Returning to landing in{" "}
          <span className="font-mono tabular-nums">{secondsLeft}s</span>
        </p>
      </div>

      <footer className="relative flex items-center justify-end border-t px-8 py-5">
        <Button
          type="button"
          size="lg"
          onClick={onDone}
          className="h-14 px-10 text-base"
        >
          Capture another
        </Button>
      </footer>
    </div>
  );
}

function formatTicketRange(numbers: number[]): string {
  if (numbers.length === 0) return "";
  if (numbers.length === 1) return `#${numbers[0]}`;
  const sorted = [...numbers].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `#${first}–#${last}`;
}
