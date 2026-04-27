"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { searchEntrants } from "@/lib/actions/entrant";

export type EntrantSelection =
  | {
      mode: "existing";
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
    }
  | {
      mode: "new";
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      sponsorShareOptIn: boolean;
      smsOptIn: boolean;
    };

type SearchHit = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
};

type ViewState =
  | { kind: "searching" }
  | { kind: "selected"; match: SearchHit }
  | { kind: "new" };

const newEntrantSchema = z.object({
  firstName: z.string().min(1, "First name is required.").max(100),
  lastName: z.string().min(1, "Last name is required.").max(100),
  email: z.string().email("Enter a valid email address."),
  phone: z.string().max(50),
  sponsorShareOptIn: z.boolean(),
  smsOptIn: z.boolean(),
});
type NewFormValues = z.infer<typeof newEntrantSchema>;

// Shared touch-target hygiene: kill the iOS grey tap flash, prevent
// long-press text selection on tile buttons, give keyboard users a
// visible focus ring.
const TAP =
  "select-none [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export function EntrantStep({
  initial,
  onBack,
  onNext,
}: {
  initial: EntrantSelection | null;
  onBack: () => void;
  onNext: (selection: EntrantSelection) => void;
}) {
  const [view, setView] = useState<ViewState>(() => {
    if (initial?.mode === "existing") {
      return {
        kind: "selected",
        match: {
          id: initial.id,
          firstName: initial.firstName,
          lastName: initial.lastName,
          email: initial.email,
          phone: initial.phone,
        },
      };
    }
    if (initial?.mode === "new") return { kind: "new" };
    return { kind: "searching" };
  });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  const newForm = useForm<NewFormValues>({
    resolver: zodResolver(newEntrantSchema),
    defaultValues: {
      firstName: initial?.mode === "new" ? initial.firstName : "",
      lastName: initial?.mode === "new" ? initial.lastName : "",
      email: initial?.mode === "new" ? initial.email : "",
      phone: initial?.mode === "new" ? initial.phone : "",
      sponsorShareOptIn:
        initial?.mode === "new" ? initial.sponsorShareOptIn : false,
      smsOptIn: initial?.mode === "new" ? initial.smsOptIn : false,
    },
  });

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const hits = await searchEntrants(trimmed, 5);
        if (seq !== searchSeq.current) return;
        setResults(hits);
      } catch {
        if (seq !== searchSeq.current) return;
        setResults([]);
        toast.error("Couldn't search entrants — check your connection.");
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function selectMatch(match: SearchHit) {
    setView({ kind: "selected", match });
  }

  function startNew() {
    setView({ kind: "new" });
  }

  function backToSearch() {
    setView({ kind: "searching" });
  }

  function submit() {
    if (view.kind === "selected") {
      onNext({
        mode: "existing",
        id: view.match.id,
        firstName: view.match.firstName,
        lastName: view.match.lastName,
        email: view.match.email,
        phone: view.match.phone,
      });
      return;
    }
    if (view.kind === "new") {
      newForm.handleSubmit((values) => {
        onNext({
          mode: "new",
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          sponsorShareOptIn: values.sponsorShareOptIn,
          smsOptIn: values.smsOptIn,
        });
      })();
      return;
    }
    // view.kind === "searching" — nothing selected yet; do nothing.
  }

  const canSubmit = view.kind !== "searching";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Who&apos;s buying?
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              {view.kind === "selected"
                ? "Confirm the customer's details, then carry on."
                : view.kind === "new"
                  ? "Capture their details to enter for the first time."
                  : "Search by name, email, or phone — or add a new entrant."}
            </p>
          </div>

          {view.kind === "searching" && (
            <SearchView
              query={query}
              onQueryChange={setQuery}
              results={results}
              searching={searching}
              onSelect={selectMatch}
              onAddNew={startNew}
            />
          )}

          {view.kind === "selected" && (
            <WelcomeBack match={view.match} onChange={backToSearch} />
          )}

          {view.kind === "new" && (
            <NewEntrantForm form={newForm} onBackToSearch={backToSearch} />
          )}
        </div>
      </div>

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
          onClick={submit}
          disabled={!canSubmit}
          className="h-14 px-8 text-base"
        >
          Next
        </Button>
      </footer>
    </div>
  );
}

function SearchView({
  query,
  onQueryChange,
  results,
  searching,
  onSelect,
  onAddNew,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  results: SearchHit[];
  searching: boolean;
  onSelect: (m: SearchHit) => void;
  onAddNew: () => void;
}) {
  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;
  const showEmpty = hasQuery && !searching && results.length === 0;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="entrant-search" className="text-base">
          Search entrants
        </Label>
        <Input
          id="entrant-search"
          autoFocus
          autoComplete="off"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Name, email, or phone"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="h-14 text-lg"
        />
        <div className="min-h-5 text-sm text-muted-foreground">
          {searching && hasQuery
            ? "Searching…"
            : !hasQuery
              ? "Type at least 2 characters."
              : null}
        </div>
      </div>

      {results.length > 0 && (
        <ul className="space-y-3">
          {results.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => onSelect(hit)}
                className={cn(
                  TAP,
                  "block w-full rounded-lg border bg-background px-5 py-4 text-left transition hover:border-primary/60 hover:bg-primary/5",
                )}
              >
                <p className="truncate text-lg font-semibold tracking-tight">
                  {hit.firstName} {hit.lastName}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {hit.email}
                  {hit.phone && (
                    <>
                      <span className="mx-2">·</span>
                      {hit.phone}
                    </>
                  )}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showEmpty && (
        <div className="rounded-lg border border-dashed bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
          No matches for &ldquo;{trimmed}&rdquo;.
        </div>
      )}

      <button
        type="button"
        onClick={onAddNew}
        className={cn(
          TAP,
          "flex w-full items-center justify-between rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-5 py-5 text-left transition hover:border-primary hover:bg-primary/10",
        )}
      >
        <div>
          <p className="text-base font-semibold text-primary">
            Add as new entrant
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Capture their details from scratch.
          </p>
        </div>
        <span className="text-2xl text-primary" aria-hidden>
          +
        </span>
      </button>
    </div>
  );
}

function WelcomeBack({
  match,
  onChange,
}: {
  match: SearchHit;
  onChange: () => void;
}) {
  return (
    <div className="rounded-lg border bg-primary/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Welcome back
          </p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight">
            {match.firstName} {match.lastName}
          </p>
          <p className="mt-1 truncate text-base text-muted-foreground">
            {match.email}
          </p>
          {match.phone && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {match.phone}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onChange}
          className="h-12 shrink-0 px-6 text-base"
        >
          Change
        </Button>
      </div>
    </div>
  );
}

function NewEntrantForm({
  form,
  onBackToSearch,
}: {
  form: ReturnType<typeof useForm<NewFormValues>>;
  onBackToSearch: () => void;
}) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  return (
    <div className="space-y-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBackToSearch}
          className="-ml-3 h-11 px-3 text-base"
        >
          ← Back to search
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FieldSlot
          id="firstName"
          label="First name"
          error={errors.firstName?.message}
        >
          <Input
            id="firstName"
            autoComplete="off"
            autoCapitalize="words"
            className="h-14 text-lg"
            {...register("firstName")}
          />
        </FieldSlot>
        <FieldSlot
          id="lastName"
          label="Last name"
          error={errors.lastName?.message}
        >
          <Input
            id="lastName"
            autoComplete="off"
            autoCapitalize="words"
            className="h-14 text-lg"
            {...register("lastName")}
          />
        </FieldSlot>
      </div>
      <FieldSlot id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          className="h-14 text-lg"
          {...register("email")}
        />
      </FieldSlot>
      <FieldSlot
        id="phone"
        label="Phone (optional)"
        error={errors.phone?.message}
      >
        <Input
          id="phone"
          type="tel"
          autoComplete="off"
          inputMode="tel"
          className="h-14 text-lg"
          {...register("phone")}
        />
      </FieldSlot>
      <div className="space-y-3">
        <OptInToggle
          checked={watch("sponsorShareOptIn")}
          onChange={(v) => setValue("sponsorShareOptIn", v)}
          label="Share contact details with event sponsors"
        />
        <OptInToggle
          checked={watch("smsOptIn")}
          onChange={(v) => setValue("smsOptIn", v)}
          label="OK to send SMS reminders"
        />
      </div>
    </div>
  );
}

function FieldSlot({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base">
        {label}
      </Label>
      {children}
      <div className="min-h-5 text-sm">
        {error && <span className="text-destructive">{error}</span>}
      </div>
    </div>
  );
}

function OptInToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        TAP,
        "flex w-full items-center justify-between gap-4 rounded-lg border px-5 py-4 text-left text-base transition",
        checked
          ? "border-primary bg-primary/10"
          : "border-border bg-background hover:bg-muted/40",
      )}
    >
      <span className="flex-1">{label}</span>
      <span
        className={cn(
          "flex h-7 w-12 shrink-0 items-center rounded-full border transition",
          checked
            ? "border-primary bg-primary"
            : "border-muted-foreground/40 bg-muted",
        )}
      >
        <span
          className={cn(
            "block size-5 rounded-full bg-background shadow transition",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}
