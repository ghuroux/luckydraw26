"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { searchEntrants } from "@/lib/actions/entrant";
import { createEntry } from "@/lib/actions/entry";

interface PackageOption {
  id: string;
  label: string;
  quantity: number;
  cost: string;
}

interface Props {
  eventId: string;
  entryCost: string;
  packages: PackageOption[];
}

interface EntrantSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

type EntrantMode = "existing" | "new";
type SelectionMode = "individual" | "package";

interface NewEntrantState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  sponsorShareOptIn: boolean;
  smsOptIn: boolean;
}

const EMPTY_NEW_ENTRANT: NewEntrantState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  sponsorShareOptIn: false,
  smsOptIn: false,
};

export function AddEntryButton({ eventId, entryCost, packages }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add entry</Button>
      <AddEntryDialog
        open={open}
        onOpenChange={setOpen}
        eventId={eventId}
        entryCost={entryCost}
        packages={packages}
      />
    </>
  );
}

function AddEntryDialog({
  open,
  onOpenChange,
  eventId,
  entryCost,
  packages,
}: Props & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Entrant state
  const [entrantMode, setEntrantMode] = useState<EntrantMode>("existing");
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<EntrantSummary[]>([]);
  const [selected, setSelected] = useState<EntrantSummary | null>(null);
  const [newEntrant, setNewEntrant] = useState<NewEntrantState>(EMPTY_NEW_ENTRANT);

  // Selection state
  const hasPackages = packages.length > 0;
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("individual");
  const [individualQty, setIndividualQty] = useState("1");
  const [packageId, setPackageId] = useState<string>(packages[0]?.id ?? "");

  // Optional fields
  const [donation, setDonation] = useState("");
  const [paymentRef, setPaymentRef] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset when dialog closes
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setEntrantMode("existing");
      setSearchInput("");
      setResults([]);
      setSelected(null);
      setNewEntrant(EMPTY_NEW_ENTRANT);
      setSelectionMode("individual");
      setIndividualQty("1");
      setPackageId(packages[0]?.id ?? "");
      setDonation("");
      setPaymentRef("");
      setError(null);
      setSuccess(null);
    }, 200);
    return () => clearTimeout(t);
  }, [open, packages]);

  // Debounced typeahead
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (entrantMode !== "existing") return;
    if (selected) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchInput.trim()) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      startTransition(async () => {
        const found = await searchEntrants(searchInput, 8);
        setResults(found);
      });
    }, 200);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchInput, entrantMode, selected]);

  // Running total
  const total = useMemo(() => {
    const cost = (() => {
      if (selectionMode === "individual") {
        const qty = Number(individualQty) || 0;
        return qty * Number(entryCost);
      }
      const pkg = packages.find((p) => p.id === packageId);
      return pkg ? Number(pkg.cost) : 0;
    })();
    const donationAmount = donation ? Number(donation) : 0;
    return cost + (Number.isFinite(donationAmount) ? donationAmount : 0);
  }, [selectionMode, individualQty, packageId, packages, entryCost, donation]);

  const canSubmit =
    !submitting &&
    (entrantMode === "existing" ? !!selected : isNewEntrantValid(newEntrant)) &&
    (selectionMode === "individual"
      ? Number(individualQty) >= 1
      : !!packageId);

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const input = {
      entrant:
        entrantMode === "existing"
          ? { mode: "existing" as const, id: selected!.id }
          : { mode: "new" as const, data: newEntrant },
      selection:
        selectionMode === "individual"
          ? { mode: "individual" as const, quantity: individualQty }
          : { mode: "package" as const, packageId },
      donationAmount: donation || undefined,
      paymentRef: paymentRef || undefined,
    };

    const result = await createEntry(eventId, input);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    const tickets = result.data?.ticketNumbers ?? [];
    setSuccess(
      tickets.length === 1
        ? `Created ticket #${tickets[0]}.`
        : `Created tickets #${tickets[0]}–#${tickets[tickets.length - 1]}.`,
    );
    router.refresh();
    // Auto-close after a beat so the user sees the confirmation
    setTimeout(() => onOpenChange(false), 1200);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add entry</DialogTitle>
          <DialogDescription>
            Search for an existing entrant or create a new one, then pick what
            they're buying.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <EntrantSection
            mode={entrantMode}
            onModeChange={(m) => {
              setEntrantMode(m);
              setSelected(null);
              setSearchInput("");
            }}
            searchInput={searchInput}
            onSearchInput={setSearchInput}
            results={results}
            selected={selected}
            onSelect={(e) => {
              setSelected(e);
              setSearchInput("");
              setResults([]);
            }}
            onClearSelected={() => setSelected(null)}
            newEntrant={newEntrant}
            onNewEntrantChange={(patch) =>
              setNewEntrant((prev) => ({ ...prev, ...patch }))
            }
          />

          <SelectionSection
            mode={selectionMode}
            onModeChange={setSelectionMode}
            individualQty={individualQty}
            onIndividualQtyChange={setIndividualQty}
            packages={packages}
            packageId={packageId}
            onPackageIdChange={setPackageId}
            entryCost={entryCost}
            hasPackages={hasPackages}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="donation">Donation (optional)</Label>
              <Input
                id="donation"
                inputMode="decimal"
                placeholder="0.00"
                value={donation}
                onChange={(e) => setDonation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentRef">Payment reference (optional)</Label>
              <Input
                id="paymentRef"
                placeholder="If provided, marks as paid"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>
          </div>

          <Card className="bg-muted/30">
            <CardContent className="flex items-center justify-between py-3 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="text-lg font-semibold tabular-nums">
                {total.toFixed(2)}
              </span>
            </CardContent>
          </Card>

          {error && (
            <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-md bg-primary/10 p-2 text-sm">{success}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Creating…" : "Create entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isNewEntrantValid(e: NewEntrantState) {
  return (
    e.firstName.trim().length > 0 &&
    e.lastName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(e.email)
  );
}

interface EntrantSectionProps {
  mode: EntrantMode;
  onModeChange: (m: EntrantMode) => void;
  searchInput: string;
  onSearchInput: (s: string) => void;
  results: EntrantSummary[];
  selected: EntrantSummary | null;
  onSelect: (e: EntrantSummary) => void;
  onClearSelected: () => void;
  newEntrant: NewEntrantState;
  onNewEntrantChange: (patch: Partial<NewEntrantState>) => void;
}

function EntrantSection({
  mode,
  onModeChange,
  searchInput,
  onSearchInput,
  results,
  selected,
  onSelect,
  onClearSelected,
  newEntrant,
  onNewEntrantChange,
}: EntrantSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Entrant</Label>
        <div className="flex gap-1 rounded-md border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onModeChange("existing")}
            className={
              "rounded-sm px-2 py-1 transition " +
              (mode === "existing"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            Existing
          </button>
          <button
            type="button"
            onClick={() => onModeChange("new")}
            className={
              "rounded-sm px-2 py-1 transition " +
              (mode === "new"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            New
          </button>
        </div>
      </div>

      {mode === "existing" ? (
        selected ? (
          <Card>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">
                  {selected.firstName} {selected.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selected.email}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelected}
              >
                Change
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="Search by name, email, or phone…"
              value={searchInput}
              onChange={(e) => onSearchInput(e.target.value)}
              autoFocus
            />
            {results.length > 0 && (
              <div className="max-h-60 overflow-auto rounded-md border">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelect(r)}
                    className="flex w-full items-baseline justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
                  >
                    <span>
                      <span className="font-medium">
                        {r.firstName} {r.lastName}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {r.email}
                      </span>
                    </span>
                    {r.phone && (
                      <span className="text-xs text-muted-foreground">
                        {r.phone}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {searchInput && results.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No matches. Switch to “New” to create a new entrant.
              </p>
            )}
          </div>
        )
      ) : (
        <div className="space-y-3 rounded-md border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="First name"
              value={newEntrant.firstName}
              onChange={(e) => onNewEntrantChange({ firstName: e.target.value })}
            />
            <Input
              placeholder="Last name"
              value={newEntrant.lastName}
              onChange={(e) => onNewEntrantChange({ lastName: e.target.value })}
            />
          </div>
          <Input
            type="email"
            placeholder="Email"
            value={newEntrant.email}
            onChange={(e) => onNewEntrantChange({ email: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Phone (optional)"
              value={newEntrant.phone}
              onChange={(e) => onNewEntrantChange({ phone: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Date of birth"
              value={newEntrant.dateOfBirth}
              onChange={(e) =>
                onNewEntrantChange({ dateOfBirth: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={newEntrant.sponsorShareOptIn}
                onChange={(e) =>
                  onNewEntrantChange({ sponsorShareOptIn: e.target.checked })
                }
                className="mt-0.5 size-4 rounded border-border"
              />
              <span>Share contact details with event sponsors</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={newEntrant.smsOptIn}
                onChange={(e) =>
                  onNewEntrantChange({ smsOptIn: e.target.checked })
                }
                className="mt-0.5 size-4 rounded border-border"
              />
              <span>Receive SMS messages</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

interface SelectionSectionProps {
  mode: SelectionMode;
  onModeChange: (m: SelectionMode) => void;
  individualQty: string;
  onIndividualQtyChange: (s: string) => void;
  packages: PackageOption[];
  packageId: string;
  onPackageIdChange: (id: string) => void;
  entryCost: string;
  hasPackages: boolean;
}

function SelectionSection({
  mode,
  onModeChange,
  individualQty,
  onIndividualQtyChange,
  packages,
  packageId,
  onPackageIdChange,
  entryCost,
  hasPackages,
}: SelectionSectionProps) {
  return (
    <div className="space-y-3">
      <Label>What they're buying</Label>
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => onModeChange("individual")}
          className={
            "rounded-md border px-3 py-2 transition " +
            (mode === "individual"
              ? "border-primary bg-primary/5"
              : "hover:bg-muted/50")
          }
        >
          Individual entries
        </button>
        <button
          type="button"
          onClick={() => onModeChange("package")}
          disabled={!hasPackages}
          className={
            "rounded-md border px-3 py-2 transition " +
            (mode === "package"
              ? "border-primary bg-primary/5"
              : "hover:bg-muted/50") +
            (!hasPackages ? " cursor-not-allowed opacity-50" : "")
          }
        >
          Package
          {!hasPackages && (
            <span className="ml-1 text-xs">(none active)</span>
          )}
        </button>
      </div>

      {mode === "individual" ? (
        <div className="flex items-center gap-3">
          <Input
            inputMode="numeric"
            value={individualQty}
            onChange={(e) => onIndividualQtyChange(e.target.value)}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">
            × {entryCost} each
          </span>
        </div>
      ) : (
        <Select
          value={packageId}
          onValueChange={(value) => onPackageIdChange(value ?? "")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {packages.map((pkg) => (
              <SelectItem key={pkg.id} value={pkg.id}>
                {pkg.label} — {pkg.quantity} for {pkg.cost}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
