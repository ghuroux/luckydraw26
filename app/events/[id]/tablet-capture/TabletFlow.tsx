"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { EntrantStep, type EntrantSelection } from "./EntrantStep";
import { SelectionStep, type TicketSelection } from "./SelectionStep";
import {
  PaymentStep,
  type ConfirmationPayload,
} from "./PaymentStep";
import { ConfirmationStep } from "./ConfirmationStep";

export type TabletEvent = {
  id: string;
  name: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "DRAWN";
  entryCost: string;
  soldCount: number;
};

export type TabletPackage = {
  id: string;
  label: string;
  quantity: number;
  cost: string;
};

type Step = "landing" | "entrant" | "selection" | "payment" | "confirmation";

const STEPS: { key: Step; label: string }[] = [
  { key: "entrant", label: "Entrant" },
  { key: "selection", label: "Selection" },
  { key: "payment", label: "Payment" },
  { key: "confirmation", label: "Done" },
];

const STEP_INDEX: Record<Step, number> = {
  landing: -1,
  entrant: 0,
  selection: 1,
  payment: 2,
  confirmation: 3,
};

export function TabletFlow({
  event,
  packages,
  idleMinutes,
}: {
  event: TabletEvent;
  packages: TabletPackage[];
  idleMinutes: number;
}) {
  const router = useRouter();
  useIdleLogout(idleMinutes, router);
  const [step, setStep] = useState<Step>("landing");
  const [entrant, setEntrant] = useState<EntrantSelection | null>(null);
  const [selection, setSelection] = useState<TicketSelection | null>(null);
  const [donation, setDonation] = useState<string>("");
  const [confirmation, setConfirmation] =
    useState<ConfirmationPayload | null>(null);

  const total = useMemo(() => {
    if (!selection) return 0;
    const pkg = selection.packageId
      ? packages.find((p) => p.id === selection.packageId) ?? null
      : null;
    const individualRate = pkg
      ? Number(pkg.cost) / pkg.quantity
      : Number(event.entryCost);
    const lineCost =
      (pkg ? Number(pkg.cost) : 0) + selection.individualQty * individualRate;
    const donationNum = donation.trim() ? Number(donation) : 0;
    return lineCost + (Number.isFinite(donationNum) ? donationNum : 0);
  }, [selection, donation, packages, event.entryCost]);

  const goLanding = () => {
    setStep("landing");
    setEntrant(null);
    setSelection(null);
    setDonation("");
    setConfirmation(null);
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col">
      {step !== "landing" && (
        <StepHeader current={step} onCancel={goLanding} />
      )}
      <main className="flex flex-1 flex-col">
        <div key={step} className="flex flex-1 flex-col animate-enter-step">
          {step === "landing" && (
            <LandingStep event={event} onStart={() => setStep("entrant")} />
          )}
          {step === "entrant" && (
            <EntrantStep
              initial={entrant}
              onBack={goLanding}
              onNext={(selection) => {
                setEntrant(selection);
                setStep("selection");
              }}
            />
          )}
          {step === "selection" && (
            <SelectionStep
              entryCost={event.entryCost}
              packages={packages}
              initialSelection={selection}
              initialDonation={donation}
              onBack={() => setStep("entrant")}
              onNext={(nextSelection, nextDonation) => {
                setSelection(nextSelection);
                setDonation(nextDonation);
                setStep("payment");
              }}
            />
          )}
          {step === "payment" && entrant && selection && (
            <PaymentStep
              eventId={event.id}
              entrant={entrant}
              selection={selection}
              donation={donation}
              total={total}
              onBack={() => setStep("selection")}
              onConfirmed={(payload) => {
                setConfirmation(payload);
                setStep("confirmation");
              }}
            />
          )}
          {step === "confirmation" && confirmation && (
            <ConfirmationStep payload={confirmation} onDone={goLanding} />
          )}
        </div>
      </main>
    </div>
  );
}

function StepHeader({
  current,
  onCancel,
}: {
  current: Step;
  onCancel: () => void;
}) {
  const idx = STEP_INDEX[current];
  return (
    <header className="flex items-center justify-between border-b px-8 py-5">
      <div className="flex items-center gap-3">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-full font-mono text-sm font-semibold tabular-nums transition-colors",
                i < idx && "bg-primary/15 text-primary",
                i === idx && "bg-primary text-primary-foreground shadow-xs",
                i > idx && "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "hidden text-sm sm:inline",
                i === idx ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-8 transition-colors",
                  i < idx ? "bg-primary/40" : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="lg"
        onClick={onCancel}
        className="h-12 px-6 text-base"
      >
        Cancel
      </Button>
    </header>
  );
}

function useIdleLogout(
  minutes: number,
  router: ReturnType<typeof useRouter>,
) {
  useEffect(() => {
    if (minutes <= 0) return;
    const ms = minutes * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;
    let signingOut = false;
    const expire = async () => {
      if (signingOut) return;
      signingOut = true;
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(expire, ms);
    };
    reset();
    const events = ["pointerdown", "touchstart", "keydown", "mousemove"];
    events.forEach((e) =>
      window.addEventListener(e, reset, { passive: true }),
    );
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes, router]);
}

function LandingStep({
  event,
  onStart,
}: {
  event: TabletEvent;
  onStart: () => void;
}) {
  const open = event.status === "OPEN";
  const soldLabel = `${event.soldCount.toLocaleString()} ${
    event.soldCount === 1 ? "entry" : "entries"
  } sold`;
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-8 py-16 text-center">
      {/* Subtle gradient backdrop — primary tint above, celebration below */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 70%), radial-gradient(50% 40% at 50% 100%, color-mix(in oklch, var(--celebration) 7%, transparent), transparent 70%)",
        }}
      />

      <div className="relative">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground">
          Tablet capture
        </p>
        <h1 className="mt-5 text-display-md font-semibold tracking-tight md:text-display-lg">
          {event.name}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">
            {event.soldCount.toLocaleString()}
          </span>{" "}
          {event.soldCount === 1 ? "entry" : "entries"} sold
        </p>
        <span className="sr-only">{soldLabel}</span>

        <div className="mt-12 w-full max-w-md">
          {open ? (
            <Button
              size="lg"
              onClick={onStart}
              className="h-20 w-full text-2xl font-semibold shadow-md hover:shadow-lg"
            >
              Sell ticket
            </Button>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/40 px-6 py-8 text-base text-muted-foreground">
              Event is{" "}
              <span className="font-semibold text-foreground">
                {event.status}
              </span>{" "}
              — entries can&apos;t be captured here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
