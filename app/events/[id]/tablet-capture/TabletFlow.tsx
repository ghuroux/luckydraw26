"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { formatMoney } from "@/lib/money";
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
  prizeCount: number;
  prizePreview: string[];
};

export type TabletPackage = {
  id: string;
  label: string;
  quantity: number;
  cost: string;
};

export type TabletLandingData = {
  supporterCount: number;
  totalRevenue: number;
  showSupporterNames: boolean;
  supporters: Array<{ name: string; ticketCount: number | null }>;
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
  landing,
}: {
  event: TabletEvent;
  packages: TabletPackage[];
  idleMinutes: number;
  landing: TabletLandingData;
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
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {step !== "landing" && (
        <StepHeader current={step} onCancel={goLanding} />
      )}
      <main className="flex flex-1 flex-col min-h-0">
        <div key={step} className="flex flex-1 flex-col min-h-0 animate-enter-step">
          {step === "landing" && (
            <LandingStep
              event={event}
              landing={landing}
              onStart={() => setStep("entrant")}
            />
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
  landing,
  onStart,
}: {
  event: TabletEvent;
  landing: TabletLandingData;
  onStart: () => void;
}) {
  const open = event.status === "OPEN";
  const showScroller =
    landing.showSupporterNames && landing.supporters.length > 0;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Warm gradient backdrop — primary tint above, celebration below */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 50% at 50% 0%, color-mix(in oklch, var(--primary) 9%, transparent), transparent 70%), radial-gradient(60% 50% at 50% 100%, color-mix(in oklch, var(--celebration) 9%, transparent), transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-5 px-6 py-6 text-center sm:gap-6 sm:py-8">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:text-xs">
            Tablet capture
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-display-xs md:text-display-sm">
            {event.name}
          </h1>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
            Tonight is possible because of you. Every ticket is a step closer
            to something good.
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
          <LandingStat
            label="Tickets"
            value={event.soldCount.toLocaleString()}
          />
          <LandingStat
            label={landing.supporterCount === 1 ? "Supporter" : "Supporters"}
            value={landing.supporterCount.toLocaleString()}
          />
          <LandingStat
            label="Raised"
            value={formatMoney(landing.totalRevenue)}
          />
        </div>

        {event.prizePreview.length > 0 && (
          <div className="w-full space-y-2">
            <p
              className="text-[10px] font-medium uppercase tracking-[0.22em] sm:text-[11px]"
              style={{
                color:
                  "color-mix(in oklch, var(--celebration) 55%, var(--foreground))",
              }}
            >
              What you could win tonight
            </p>
            <ul className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
              {event.prizePreview.map((name, i) => (
                <li
                  key={i}
                  className="rounded-full bg-card px-3 py-1 text-xs text-foreground ring-1 ring-inset ring-foreground/10 sm:text-sm"
                >
                  {name}
                </li>
              ))}
              {event.prizeCount > event.prizePreview.length && (
                <li className="rounded-full bg-muted px-3 py-1 text-xs font-mono tabular-nums text-muted-foreground sm:text-sm">
                  +{event.prizeCount - event.prizePreview.length} more
                </li>
              )}
            </ul>
          </div>
        )}

        {open ? (
          <Button
            size="lg"
            onClick={onStart}
            className="h-16 w-full max-w-md text-xl font-semibold shadow-md hover:shadow-lg sm:h-20 sm:text-2xl"
          >
            Sell ticket
          </Button>
        ) : (
          <div className="w-full max-w-md rounded-xl border border-dashed bg-muted/40 px-6 py-6 text-sm text-muted-foreground sm:text-base">
            Event is{" "}
            <span className="font-semibold text-foreground">
              {event.status}
            </span>{" "}
            — entries can&apos;t be captured here.
          </div>
        )}

        {showScroller && (
          <TabletSupporterScroller supporters={landing.supporters} />
        )}
      </div>
    </div>
  );
}

function LandingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/8 shadow-xs sm:rounded-2xl sm:px-4 sm:py-4">
      <p
        className="text-[10px] font-medium uppercase tracking-[0.16em]"
        style={{
          color:
            "color-mix(in oklch, var(--celebration) 50%, var(--muted-foreground))",
        }}
      >
        {label}
      </p>
      <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-foreground sm:mt-2 sm:text-2xl md:text-3xl">
        {value}
      </p>
    </div>
  );
}

function TabletSupporterScroller({
  supporters,
}: {
  supporters: Array<{ name: string; ticketCount: number | null }>;
}) {
  // Pace: ~1.4s per name, clamped 18–90s. Same scaling as the presentation
  // version so per-name pace stays comfortable across event sizes.
  const durationSeconds = Math.min(90, Math.max(18, supporters.length * 1.4));
  const doubled = [...supporters, ...supporters];
  const hasCounts = supporters.some((s) => s.ticketCount !== null);

  return (
    <div className="w-full max-w-2xl space-y-3">
      <p
        className="text-[10px] font-medium uppercase tracking-[0.25em]"
        style={{
          color:
            "color-mix(in oklch, var(--celebration) 55%, var(--foreground))",
        }}
      >
        Our supporters tonight
      </p>
      <div className="relative h-24 overflow-hidden rounded-2xl bg-card/60 ring-1 ring-inset ring-foreground/8 sm:h-28">
        {/* Light-tone fade masks (matches the surrounding background) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/4 bg-gradient-to-b from-background to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/4 bg-gradient-to-t from-background to-transparent" />

        <ul
          className="flex flex-col px-4"
          style={{
            animation: `supporter-scroll ${durationSeconds}s linear infinite`,
          }}
        >
          {doubled.map((s, i) => (
            <li
              key={i}
              className={`flex items-center gap-4 py-1.5 text-base font-medium text-foreground ${hasCounts ? "justify-between" : "justify-center"}`}
            >
              <span className="truncate">{s.name}</span>
              {s.ticketCount !== null && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs tabular-nums text-foreground">
                  {s.ticketCount}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
