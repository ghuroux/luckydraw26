"use client";

import { useState, useTransition } from "react";
import { Banknote, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createEntry } from "@/lib/actions/entry";
import type { EntrantSelection } from "./EntrantStep";
import type { TicketSelection } from "./SelectionStep";

export type PaymentMethodChoice = "CASH" | "CARD";

const TAP =
  "select-none [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export type ConfirmationPayload = {
  ticketNumbers: number[];
  total: number;
  paymentMethod: PaymentMethodChoice;
  entrantFirstName: string;
  entrantLastName: string;
};

export function PaymentStep({
  eventId,
  entrant,
  selection,
  donation,
  total,
  onBack,
  onConfirmed,
}: {
  eventId: string;
  entrant: EntrantSelection;
  selection: TicketSelection;
  donation: string;
  total: number;
  onBack: () => void;
  onConfirmed: (payload: ConfirmationPayload) => void;
}) {
  const [method, setMethod] = useState<PaymentMethodChoice | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!method) return;
    const input = {
      entrant:
        entrant.mode === "existing"
          ? { mode: "existing" as const, id: entrant.id }
          : {
              mode: "new" as const,
              data: {
                firstName: entrant.firstName,
                lastName: entrant.lastName,
                email: entrant.email,
                phone: entrant.phone,
                sponsorShareOptIn: entrant.sponsorShareOptIn,
                smsOptIn: entrant.smsOptIn,
              },
            },
      selection: {
        packageId: selection.packageId ?? undefined,
        individualQty:
          selection.individualQty > 0 ? selection.individualQty : undefined,
      },
      donationAmount: donation || undefined,
      paymentRef: paymentRef.trim() || undefined,
      paymentMethod: method,
      source: "TABLET" as const,
    };

    startTransition(async () => {
      const result = await createEntry(eventId, input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onConfirmed({
        ticketNumbers: result.data?.ticketNumbers ?? [],
        total,
        paymentMethod: method,
        entrantFirstName: entrant.firstName,
        entrantLastName: entrant.lastName,
      });
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Take payment
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Hand the device to the customer to complete payment, then capture
              how it was paid.
            </p>
          </div>

          <div className="rounded-lg border bg-primary/5 px-6 py-5">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              Amount due
            </p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {total.toFixed(2)}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Payment method
            </p>
            <div className="grid grid-cols-2 gap-3">
              <MethodTile
                active={method === "CASH"}
                onClick={() => setMethod("CASH")}
                icon={<Banknote className="size-8" aria-hidden />}
                label="Cash"
              />
              <MethodTile
                active={method === "CARD"}
                onClick={() => setMethod("CARD")}
                icon={<CreditCard className="size-8" aria-hidden />}
                label="Card"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentRef" className="text-base">
              Reference (optional)
            </Label>
            <Input
              id="paymentRef"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Card slip number or note"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className="h-14 text-lg"
            />
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t px-8 py-5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          disabled={pending}
          className="h-14 px-8 text-base"
        >
          Back
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={confirm}
          disabled={!method || pending}
          className="h-14 px-10 text-base"
        >
          {pending ? "Confirming…" : "Confirm sale"}
        </Button>
      </footer>
    </div>
  );
}

function MethodTile({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        TAP,
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 px-6 py-8 text-center transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5",
      )}
    >
      {icon}
      <span className="text-xl font-semibold tracking-tight">{label}</span>
    </button>
  );
}
