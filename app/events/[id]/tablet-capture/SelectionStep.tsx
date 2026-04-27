"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TabletPackage } from "./TabletFlow";

export type TicketSelection = {
  packageId: string | null;
  individualQty: number;
};

const DONATION_REGEX = /^\d+(\.\d{1,2})?$/;
const MAX_TOTAL = 100;

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
  const remainingHeadroom = MAX_TOTAL - totalQty;

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

  const canSubmit = totalQty >= 1 && totalQty <= MAX_TOTAL;

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
      const cap = MAX_TOTAL - pkgQty;
      if (next > cap) return cap;
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
      <div className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Pick a ticket option
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Tap a package and/or set a number of single tickets.
            </p>
          </div>

          {packages.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Packages
              </p>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          "block w-full rounded-lg border-2 px-5 py-4 text-left transition",
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:border-primary/50 hover:bg-primary/5",
                        )}
                      >
                        <p className="truncate text-lg font-semibold tracking-tight">
                          {pkg.label}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {pkg.quantity}{" "}
                          {pkg.quantity === 1 ? "ticket" : "tickets"}
                        </p>
                        <p className="mt-3 text-xl font-semibold tabular-nums">
                          {Number(pkg.cost).toFixed(2)}
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
            atCap={individualQty >= MAX_TOTAL - pkgQty}
            onBump={bumpQuantity}
          />

          {remainingHeadroom < 5 && totalQty <= MAX_TOTAL && (
            <p className="text-sm text-muted-foreground">
              Maximum {MAX_TOTAL} tickets per transaction
              {totalQty === MAX_TOTAL ? " (reached)." : `, ${remainingHeadroom} left.`}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="donation" className="text-base">
              Donation (optional)
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
              className="h-14 max-w-xs text-lg tabular-nums"
            />
            <div className="min-h-5 text-sm">
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

      <footer className="flex items-center justify-between border-t px-8 py-5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          className="h-14 px-8 text-base"
        >
          Back
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={handleNext}
          disabled={!canSubmit}
          className="h-14 px-8 text-base"
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
  const lineTotal = (quantity * rate).toFixed(2);
  const active = quantity >= 1;
  return (
    <div
      className={cn(
        "rounded-lg border-2 px-5 py-4 transition",
        active ? "border-primary bg-primary/10" : "border-border bg-background",
      )}
    >
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {isProrated ? "Extra tickets" : "Single tickets"}
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight">
          {rate.toFixed(2)} each
          {isProrated && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              (package rate)
            </span>
          )}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <StepperButton
            onClick={() => onBump(-1)}
            disabled={quantity <= 0}
            label="Decrease"
          >
            −
          </StepperButton>
          <span className="w-14 text-center text-3xl font-semibold tabular-nums">
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
        <p className="text-xl font-semibold tabular-nums">
          {active ? lineTotal : "—"}
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
        "flex size-14 items-center justify-center rounded-full border-2 text-3xl font-semibold leading-none transition",
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
    <div className="border-t bg-muted/30 px-8 py-4">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </p>
          <p className="text-xs text-muted-foreground">
            {showZeroHint
              ? "Pick a package or add a single ticket."
              : `${ticketCount} ${ticketCount === 1 ? "ticket" : "tickets"}`}
          </p>
        </div>
        <span className="text-3xl font-semibold tabular-nums">
          {total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
