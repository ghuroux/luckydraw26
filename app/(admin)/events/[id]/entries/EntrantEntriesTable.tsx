"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shell";
import { cn } from "@/lib/utils";
import { displayEmail } from "@/lib/entrant-contact";
import { entrySourceLabel, entrySourceTone } from "@/lib/entry-status";
import { formatMoney } from "@/lib/money";
import {
  markEntrantEntriesPaidForEvent,
  type EntrantSummaryForEvent,
} from "@/lib/actions/entry";

interface Props {
  eventId: string;
  entrants: EntrantSummaryForEvent[];
}

export function EntrantEntriesTable({ eventId, entrants }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState<EntrantSummaryForEvent | null>(
    null,
  );

  return (
    <>
      <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/8">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-sunken/60 hover:bg-surface-sunken/60">
              <TableHead className="w-10" />
              <TableHead>Entrant</TableHead>
              <TableHead className="text-right">Tickets</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Donation</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entrants.map((row) => (
              <EntrantRow
                key={row.entrant.id}
                row={row}
                expanded={expanded === row.entrant.id}
                onToggle={() =>
                  setExpanded((prev) =>
                    prev === row.entrant.id ? null : row.entrant.id,
                  )
                }
                onReconcile={() => setReconciling(row)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <ReconcileDialog
        eventId={eventId}
        target={reconciling}
        onClose={() => setReconciling(null)}
      />
    </>
  );
}

function EntrantRow({
  row,
  expanded,
  onToggle,
  onReconcile,
}: {
  row: EntrantSummaryForEvent;
  expanded: boolean;
  onToggle: () => void;
  onReconcile: () => void;
}) {
  const email = displayEmail(row.entrant);
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40"
        onClick={onToggle}
      >
        <TableCell>
          <ChevronRight
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              expanded && "rotate-90",
            )}
            aria-hidden
          />
        </TableCell>
        <TableCell className="font-medium">
          <Link
            href={`/entrants/${row.entrant.id}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:text-primary"
          >
            {row.entrant.firstName} {row.entrant.lastName}
          </Link>
          <p className="font-mono text-xs font-normal text-muted-foreground">
            {email ?? (
              <span className="italic opacity-70 not-italic">No email</span>
            )}
            {row.entrant.phone && (
              <>
                <span className="mx-1.5">·</span>
                {row.entrant.phone}
              </>
            )}
          </p>
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {row.ticketCount}
        </TableCell>
        <TableCell>
          <PaidBreakdown
            paidCount={row.paidCount}
            unpaidCount={row.unpaidCount}
          />
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {formatMoney(row.totalSpend)}
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
          {row.donationTotal > 0 ? formatMoney(row.donationTotal) : "—"}
        </TableCell>
        <TableCell className="text-right">
          {row.unpaidCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onReconcile();
              }}
            >
              Mark paid
            </Button>
          )}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-surface-sunken/30 hover:bg-surface-sunken/30">
          <TableCell colSpan={7} className="p-0">
            <div className="border-t border-border/60 px-6 py-4">
              <TicketBreakdown entries={row.entries} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function PaidBreakdown({
  paidCount,
  unpaidCount,
}: {
  paidCount: number;
  unpaidCount: number;
}) {
  if (unpaidCount === 0) {
    return (
      <StatusBadge tone="success" dot>
        All paid
      </StatusBadge>
    );
  }
  if (paidCount === 0) {
    return (
      <StatusBadge tone="warning" dot>
        Unpaid
      </StatusBadge>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <StatusBadge tone="success" dot>
        {paidCount} paid
      </StatusBadge>
      <StatusBadge tone="warning" dot>
        {unpaidCount} unpaid
      </StatusBadge>
    </span>
  );
}

function TicketBreakdown({
  entries,
}: {
  entries: EntrantSummaryForEvent["entries"];
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-card ring-1 ring-inset ring-border/60">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-20 py-2 text-xs">Ticket</TableHead>
            <TableHead className="py-2 text-xs">Source</TableHead>
            <TableHead className="py-2 text-xs">Package</TableHead>
            <TableHead className="py-2 text-xs">Paid</TableHead>
            <TableHead className="py-2 text-xs">Payment ref</TableHead>
            <TableHead className="py-2 text-right text-xs">Cost</TableHead>
            <TableHead className="py-2 text-right text-xs">Donation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id} className="text-sm">
              <TableCell className="py-1.5 font-mono tabular-nums text-muted-foreground">
                #{e.ticketNumber}
              </TableCell>
              <TableCell className="py-1.5">
                <StatusBadge tone={entrySourceTone(e.source)}>
                  {entrySourceLabel(e.source)}
                </StatusBadge>
              </TableCell>
              <TableCell className="py-1.5 text-muted-foreground">
                {e.packageLabel ? (
                  <span>
                    {e.packageLabel}
                    {e.packageEntryNum && (
                      <span className="ml-1 font-mono tabular-nums">
                        ({e.packageEntryNum})
                      </span>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="py-1.5">
                {e.paidAt ? (
                  <StatusBadge tone="success" dot>
                    Paid
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="warning" dot>
                    Unpaid
                  </StatusBadge>
                )}
              </TableCell>
              <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">
                {e.paymentRef ?? "—"}
              </TableCell>
              <TableCell className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                {formatMoney(e.perTicketCost)}
              </TableCell>
              <TableCell className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                {e.donationAmount ? formatMoney(e.donationAmount) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReconcileDialog({
  eventId,
  target,
  onClose,
}: {
  eventId: string;
  target: EntrantSummaryForEvent | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [paymentRef, setPaymentRef] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!target) return;
    startTransition(async () => {
      const result = await markEntrantEntriesPaidForEvent(
        eventId,
        target.entrant.id,
        paymentRef || undefined,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const n = result.data?.markedCount ?? 0;
      toast.success(
        n === 0
          ? "Nothing to mark — already paid."
          : `Marked ${n} ${n === 1 ? "entry" : "entries"} as paid.`,
      );
      setPaymentRef("");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => {
        if (!o) {
          setPaymentRef("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Mark {target?.unpaidCount}{" "}
            {target?.unpaidCount === 1 ? "entry" : "entries"} as paid
          </DialogTitle>
          <DialogDescription>
            For{" "}
            <span className="font-medium text-foreground">
              {target?.entrant.firstName} {target?.entrant.lastName}
            </span>
            . Optional reference will be saved against each marked entry.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="payment-ref">Payment reference (optional)</Label>
          <Input
            id="payment-ref"
            placeholder="EFT ref, card slip number, etc."
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Marking…" : "Mark as paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
