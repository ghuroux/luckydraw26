"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <CheckCircle2 className="size-20 text-primary" aria-hidden />
        <h2 className="mt-6 text-3xl font-semibold tracking-tight">
          Sale captured
        </h2>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          {ticketCount === 1 ? "Ticket" : "Tickets"} {ticketRange} for{" "}
          <span className="font-medium text-foreground">
            {payload.entrantFirstName} {payload.entrantLastName}
          </span>
          .
        </p>
        <p className="mt-2 text-base text-muted-foreground tabular-nums">
          {payload.total.toFixed(2)} · {payload.paymentMethod}
        </p>
        <p className="mt-8 text-sm text-muted-foreground">
          Returning to landing in {secondsLeft}s
        </p>
      </div>

      <footer className="flex items-center justify-end border-t px-8 py-5">
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
  // The allocation is sequential by design, so a range is always faithful.
  return `#${first}–#${last}`;
}
