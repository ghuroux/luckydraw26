"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  analyzeEntrantImport,
  commitEntrantImport,
  type CommitImportResult,
  type ImportAnalysisResult,
  type ImportParsedRow,
} from "@/lib/actions/entrant";

type View = "pick" | "review" | "done";

type Decision = "add" | "skip";

export function ImportEntrantsButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysisResult | null>(null);
  const [decisions, setDecisions] = useState<Map<number, Decision>>(new Map());
  const [result, setResult] = useState<CommitImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setView("pick");
    setFile(null);
    setAnalysis(null);
    setDecisions(new Map());
    setResult(null);
    setError(null);
  }

  function handleClose(next: boolean) {
    setOpen(next);
    if (!next) setTimeout(reset, 200);
  }

  function analyze() {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const res = await analyzeEntrantImport(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAnalysis(res.data!);
      // Default every duplicate to "add" — preserves the conservative
      // "don't silently drop legitimate distinct people" stance.
      const defaults = new Map<number, Decision>();
      for (const d of res.data!.duplicates) {
        defaults.set(d.row.rowNumber, "add");
      }
      setDecisions(defaults);
      setView("review");
    });
  }

  function setAllDecisions(action: Decision) {
    if (!analysis) return;
    const next = new Map(decisions);
    for (const d of analysis.duplicates) {
      next.set(d.row.rowNumber, action);
    }
    setDecisions(next);
  }

  function setOneDecision(rowNumber: number, action: Decision) {
    const next = new Map(decisions);
    next.set(rowNumber, action);
    setDecisions(next);
  }

  function commit() {
    if (!analysis) return;
    const toCreate: ImportParsedRow[] = [
      ...analysis.clean,
      ...analysis.duplicates
        .filter((d) => (decisions.get(d.row.rowNumber) ?? "add") === "add")
        .map((d) => d.row),
    ];
    startTransition(async () => {
      const res = await commitEntrantImport(toCreate);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data!);
      setView("done");
      if (res.data!.created > 0) {
        toast.success(
          `Imported ${res.data!.created} ${
            res.data!.created === 1 ? "entrant" : "entrants"
          }.`,
        );
        router.refresh();
      } else {
        toast.info("No entrants were imported.");
      }
    });
  }

  const dupesToAdd = analysis
    ? analysis.duplicates.filter(
        (d) => (decisions.get(d.row.rowNumber) ?? "add") === "add",
      ).length
    : 0;
  const totalToCreate = analysis ? analysis.clean.length + dupesToAdd : 0;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload data-icon="inline-start" />
        Import CSV
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {view === "pick" && "Import entrants from CSV"}
              {view === "review" && "Review the import"}
              {view === "done" && "Import complete"}
            </DialogTitle>
            <DialogDescription>
              {view === "pick" &&
                "First Name and Last Name are required. Email and phone are optional — anyone without contact details will be prompted for them at the tablet during ticket sales."}
              {view === "review" &&
                "Some rows look like people already in the database. Decide whether to add them anyway or skip — the rest will import automatically."}
              {view === "done" && "Here's how it went."}
            </DialogDescription>
          </DialogHeader>

          {view === "pick" && (
            <PickView
              file={file}
              onFileChange={(f) => {
                setFile(f);
                setError(null);
              }}
              error={error}
            />
          )}

          {view === "review" && analysis && (
            <ReviewView
              analysis={analysis}
              decisions={decisions}
              onSetAll={setAllDecisions}
              onSetOne={setOneDecision}
              totalToCreate={totalToCreate}
            />
          )}

          {view === "done" && result && <DoneView result={result} />}

          <DialogFooter>
            {view === "pick" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button onClick={analyze} disabled={!file || pending}>
                  {pending ? "Analysing…" : "Continue"}
                </Button>
              </>
            )}
            {view === "review" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setView("pick")}
                  disabled={pending}
                >
                  Back
                </Button>
                <Button onClick={commit} disabled={pending}>
                  {pending
                    ? "Importing…"
                    : `Import ${totalToCreate} ${
                        totalToCreate === 1 ? "entrant" : "entrants"
                      }`}
                </Button>
              </>
            )}
            {view === "done" && (
              <>
                <Button variant="outline" onClick={reset}>
                  Import another
                </Button>
                <Button onClick={() => handleClose(false)}>Done</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PickView({
  file,
  onFileChange,
  error,
}: {
  file: File | null;
  onFileChange: (f: File | null) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-surface-sunken px-5 py-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5">
        <FileSpreadsheet
          className="mx-auto size-8 text-muted-foreground"
          aria-hidden
        />
        {file ? (
          <>
            <span className="text-sm font-medium text-foreground">
              {file.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB · click to choose a different
              file
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium">Choose a CSV file</span>
            <span className="text-xs text-muted-foreground">
              or drop one here
            </span>
          </>
        )}
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Accepted columns</p>
        <ul className="mt-1.5 space-y-0.5">
          <li>
            <span className="font-mono">First Name</span> /{" "}
            <span className="font-mono">Last Name</span> — required
          </li>
          <li>
            <span className="font-mono">Email</span>,{" "}
            <span className="font-mono">Phone</span> /{" "}
            <span className="font-mono">Mobile</span> — optional
          </li>
        </ul>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewView({
  analysis,
  decisions,
  onSetAll,
  onSetOne,
  totalToCreate,
}: {
  analysis: ImportAnalysisResult;
  decisions: Map<number, Decision>;
  onSetAll: (action: Decision) => void;
  onSetOne: (row: number, action: Decision) => void;
  totalToCreate: number;
}) {
  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {/* Summary row */}
      <div className="flex flex-wrap gap-2 text-sm">
        <SummaryPill
          tone="success"
          label="Clean"
          count={analysis.clean.length}
        />
        <SummaryPill
          tone="warning"
          label="To review"
          count={analysis.duplicates.length}
        />
        <SummaryPill
          tone="danger"
          label="Errors"
          count={analysis.errors.length}
        />
        <SummaryPill
          tone="neutral"
          label="Will create"
          count={totalToCreate}
        />
      </div>

      {/* Bulk actions */}
      {analysis.duplicates.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bulk:
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onSetAll("add")}
          >
            Add all anyway
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onSetAll("skip")}
          >
            Skip all duplicates
          </Button>
        </div>
      )}

      {/* Duplicate review list */}
      {analysis.duplicates.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Potential duplicates
          </p>
          <ul className="space-y-3">
            {analysis.duplicates.map((d) => (
              <DuplicateRow
                key={d.row.rowNumber}
                dup={d}
                decision={decisions.get(d.row.rowNumber) ?? "add"}
                onChange={(action) => onSetOne(d.row.rowNumber, action)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Errors summary */}
      {analysis.errors.length > 0 && (
        <div className="space-y-2 rounded-lg bg-amber-50 px-4 py-3 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:ring-amber-400/25">
          <div className="flex items-start gap-2">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300"
              aria-hidden
            />
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {analysis.errors.length}{" "}
              {analysis.errors.length === 1 ? "row" : "rows"} will be skipped
            </p>
          </div>
          <ul className="max-h-32 space-y-1 overflow-y-auto pl-6 text-xs text-amber-900/90 dark:text-amber-100/90">
            {analysis.errors.map((e, i) => (
              <li key={i}>
                <span className="font-mono">Row {e.row}</span> · {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.clean.length === 0 &&
        analysis.duplicates.length === 0 &&
        analysis.errors.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing to import — every row had a problem.
          </p>
        )}
    </div>
  );
}

function DuplicateRow({
  dup,
  decision,
  onChange,
}: {
  dup: ImportAnalysisResult["duplicates"][number];
  decision: Decision;
  onChange: (action: Decision) => void;
}) {
  const radioName = `dup-${dup.row.rowNumber}`;
  return (
    <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/8">
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold">
              {dup.row.firstName} {dup.row.lastName}{" "}
              <span className="font-mono text-xs font-normal text-muted-foreground">
                · row {dup.row.rowNumber}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Already on file
              {dup.existing.length > 1 ? ` (${dup.existing.length} matches)` : ""}:
            </p>
            <ul className="mt-1 space-y-1">
              {dup.existing.map((m) => (
                <li key={m.id} className="text-xs text-muted-foreground">
                  <span className="font-mono text-foreground">
                    {m.email.endsWith(".placeholder") ? "(no email)" : m.email}
                  </span>
                  {m.phone && (
                    <>
                      {" · "}
                      <span className="font-mono">{m.phone}</span>
                    </>
                  )}
                  {" · "}
                  <span className="font-mono tabular-nums">
                    {m.entryCount}
                  </span>{" "}
                  {m.entryCount === 1 ? "ticket" : "tickets"}
                  {m.lastSeenAt && (
                    <>
                      {" · last "}
                      <span className="font-mono">
                        {new Date(m.lastSeenAt).toLocaleDateString("en-ZA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name={radioName}
                checked={decision === "add"}
                onChange={() => onChange("add")}
                className="size-4 accent-primary"
              />
              <span>Add as new person</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name={radioName}
                checked={decision === "skip"}
                onChange={() => onChange("skip")}
                className="size-4 accent-primary"
              />
              <span className="text-muted-foreground">
                Skip — same person
              </span>
            </label>
          </div>
        </div>
      </div>
    </li>
  );
}

function SummaryPill({
  tone,
  label,
  count,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  label: string;
  count: number;
}) {
  const palette = {
    success:
      "bg-emerald-50 text-emerald-800 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
    warning:
      "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25",
    danger:
      "bg-destructive/10 text-destructive ring-destructive/20",
    neutral: "bg-muted text-foreground ring-foreground/10",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${palette[tone]}`}
    >
      {label}{" "}
      <span className="font-mono tabular-nums">{count}</span>
    </span>
  );
}

function DoneView({ result }: { result: CommitImportResult }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/20">
        <CheckCircle2
          className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
        <div>
          <p className="font-medium text-emerald-900 dark:text-emerald-100">
            {result.created}{" "}
            {result.created === 1 ? "entrant" : "entrants"} imported
          </p>
          {result.created === 0 && (
            <p className="mt-0.5 text-sm text-emerald-800/80 dark:text-emerald-100/80">
              Nothing new was added.
            </p>
          )}
        </div>
      </div>

      {result.failed.length > 0 && (
        <div className="space-y-2 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:ring-amber-400/25">
          <div className="flex items-start gap-2">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300"
              aria-hidden
            />
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {result.failed.length}{" "}
              {result.failed.length === 1 ? "row" : "rows"} failed at write
            </p>
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto pl-6 text-xs text-amber-900/90 dark:text-amber-100/90">
            {result.failed.map((s, i) => (
              <li key={i}>
                <span className="font-mono">Row {s.row}</span> · {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
