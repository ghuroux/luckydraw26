"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { TabletPackage } from "./TabletFlow";

export type TicketSelection = {
  packageId: string | null;
  individualQty: number;
};

const DONATION_REGEX = /^\d+(\.\d{1,2})?$/;
// Soft cap on *individual* tickets only — packages can be any size the org
// configures. The cap exists so an operator can't fat-finger 500 with the
// stepper buttons; the package quantity is whatever the org defined and
// isn't artificially limited here.
const MAX_INDIVIDUALS = 500;

const TAP =
  "select-none [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export function SelectionStep({
  entryCost,
  packages,
  initialSelection,
  initialDonation,
  onBack,
  onNext,
}: {
  entryCost: string;
  packages: TabletPackage[];
  initialSelection: TicketSelection | null;
  initialDonation: string;
  onBack: () => void;
  onNext: (selection: TicketSelection, donation: string) => void;
}) {
  const [packageId, setPackageId] = useState<string | null>(
    initialSelection?.packageId ?? null,
  );
  const [individualQty, setIndividualQty] = useState<number>(() => {
    if (initialSelection) return initialSelection.individualQty;
    return 1;
  });
  const [donation, setDonation] = useState<string>(initialDonation);
  const [donationError, setDonationError] = useState<string | null>(null);

  const selectedPkg = packageId
    ? packages.find((p) => p.id === packageId) ?? null
    : null;
  const pkgQty = selectedPkg?.quantity ?? 0;
  const totalQty = pkgQty + individualQty;
  const individualRemaining = MAX_INDIVIDUALS - individualQty;

  // When a package is selected, "extra" individual tickets ride at the
  // package's prorated per-ticket rate. Without a package, individuals fall
  // back to the event's regular entry cost.
  const individualRate = selectedPkg
    ? Number(selectedPkg.cost) / selectedPkg.quantity
    : Number(entryCost);

  const lineCost = useMemo(() => {
    const pkgCost = selectedPkg ? Number(selectedPkg.cost) : 0;
    return pkgCost + individualQty * individualRate;
  }, [selectedPkg, individualQty, individualRate]);

  const total = useMemo(() => {
    const donationNum = donation.trim() ? Number(donation) : 0;
    return lineCost + (Number.isFinite(donationNum) ? donationNum : 0);
  }, [lineCost, donation]);

  // At least one ticket total — package size is not capped here.
  const canSubmit = totalQty >= 1;

  function togglePackage(id: string) {
    if (packageId === id) {
      // Tapping the selected package deselects it. Bump qty back to 1 if
      // the operator now has zero tickets — they always need at least one.
      setPackageId(null);
      if (individualQty < 1) setIndividualQty(1);
      return;
    }
    setPackageId(id);
    // Default to "just the package" when a package is first chosen.
    setIndividualQty(0);
  }

  function bumpQuantity(delta: number) {
    setIndividualQty((q) => {
      const next = q + delta;
      if (next < 0) return 0;
      if (next > MAX_INDIVIDUALS) return MAX_INDIVIDUALS;
      return next;
    });
  }

  function handleNext() {
    if (donation.trim() && !DONATION_REGEX.test(donation.trim())) {
      setDonationError("Use a number with up to 2 decimals.");
      return;
    }
    setDonationError(null);
    onNext({ packageId, individualQty }, donation.trim());
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Pick a ticket option
            </h2>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Tap a package and/or set a number of single tickets.
            </p>
          </div>

          {packages.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Packages
              </p>
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                {packages.map((pkg) => {
                  const active = packageId === pkg.id;
                  return (
                    <li key={pkg.id}>
                      <button
                        type="button"
                        onClick={() => togglePackage(pkg.id)}
                        aria-pressed={active}
                        className={cn(
                          TAP,
                          "block w-full rounded-lg border-2 px-4 py-3 text-left transition sm:px-5 sm:py-4",
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:border-primary/50 hover:bg-primary/5",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-base font-semibold tracking-tight sm:text-lg">
                            {pkg.label}
                          </p>
                          <p className="shrink-0 font-mono text-base font-semibold tabular-nums sm:text-lg">
                            {formatMoney(pkg.cost)}
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                          <span className="font-mono tabular-nums">
                            {pkg.quantity}
                          </span>{" "}
                          {pkg.quantity === 1 ? "ticket" : "tickets"}
                          {" · "}
                          <span className="font-mono tabular-nums">
                            {formatMoney(Number(pkg.cost) / pkg.quantity)}
                          </span>{" "}
                          each
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <SingleTicketsTile
            rate={individualRate}
            isProrated={selectedPkg !== null}
            quantity={individualQty}
            atCap={individualQty >= MAX_INDIVIDUALS}
            onBump={bumpQuantity}
          />

          {individualRemaining < 10 && individualQty > 0 && (
            <p className="text-sm text-muted-foreground">
              Maximum {MAX_INDIVIDUALS} individual tickets per transaction
              {individualQty === MAX_INDIVIDUALS
                ? " (reached)."
                : `, ${individualRemaining} left.`}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="donation" className="text-sm sm:text-base">
              Donation{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="donation"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={donation}
              onChange={(e) => {
                setDonation(e.target.value);
                if (donationError) setDonationError(null);
              }}
              className="h-12 max-w-[14rem] font-mono text-base tabular-nums sm:h-14 sm:text-lg"
            />
            <div className="min-h-4 text-sm">
              {donationError && (
                <span className="text-destructive">{donationError}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <TotalBar
        total={total}
        ticketCount={totalQty}
        showZeroHint={totalQty === 0}
      />

      <footer className="flex items-center justify-between border-t px-6 py-4 sm:px-8 sm:py-5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          className="h-12 px-6 text-base sm:h-14 sm:px-8"
        >
          Back
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={handleNext}
          disabled={!canSubmit}
          className="h-12 px-6 text-base sm:h-14 sm:px-8"
        >
          Next
        </Button>
      </footer>
    </div>
  );
}

function SingleTicketsTile({
  rate,
  isProrated,
  quantity,
  atCap,
  onBump,
}: {
  rate: number;
  isProrated: boolean;
  quantity: number;
  atCap: boolean;
  onBump: (delta: number) => void;
}) {
  const lineTotal = quantity * rate;
  const active = quantity >= 1;
  return (
    <div
      className={cn(
        "rounded-lg border-2 px-4 py-3 transition sm:px-5 sm:py-4",
        active
          ? "border-primary bg-primary/10"
          : "border-border bg-background",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {isProrated ? "Extra tickets" : "Single tickets"}
        </p>
        <p className="font-mono text-sm font-medium tabular-nums text-muted-foreground sm:text-base">
          {formatMoney(rate)} each
          {isProrated && (
            <span className="ml-1.5 font-sans text-xs font-normal">
              (package rate)
            </span>
          )}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 sm:mt-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <StepperButton
            onClick={() => onBump(-1)}
            disabled={quantity <= 0}
            label="Decrease"
          >
            −
          </StepperButton>
          <span className="w-12 text-center font-mono text-2xl font-semibold tabular-nums sm:w-14 sm:text-3xl">
            {quantity}
          </span>
          <StepperButton
            onClick={() => onBump(1)}
            disabled={atCap}
            label="Increase"
          >
            +
          </StepperButton>
        </div>
        <p className="font-mono text-lg font-semibold tabular-nums sm:text-xl">
          {active ? formatMoney(lineTotal) : "—"}
        </p>
      </div>
    </div>
  );
}

function StepperButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        TAP,
        "flex size-12 items-center justify-center rounded-full border-2 text-2xl font-semibold leading-none transition sm:size-14 sm:text-3xl",
        disabled
          ? "border-border bg-muted text-muted-foreground"
          : "border-primary bg-background text-primary hover:bg-primary/10 active:bg-primary/20",
      )}
    >
      {children}
    </button>
  );
}

function TotalBar({
  total,
  ticketCount,
  showZeroHint,
}: {
  total: number;
  ticketCount: number;
  showZeroHint: boolean;
}) {
  return (
    <div className="border-t bg-muted/30 px-6 py-3 sm:px-8 sm:py-4">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Total
          </p>
          <p className="text-xs text-muted-foreground">
            {showZeroHint ? (
              "Pick a package or add a single ticket."
            ) : (
              <>
                <span className="font-mono tabular-nums">{ticketCount}</span>{" "}
                {ticketCount === 1 ? "ticket" : "tickets"}
              </>
            )}
          </p>
        </div>
        <span className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
          {formatMoney(total)}
        </span>
      </div>
    </div>
  );
}
