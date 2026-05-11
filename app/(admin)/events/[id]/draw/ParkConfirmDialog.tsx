"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  winnerName: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ParkConfirmDialog({
  open,
  winnerName,
  pending,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Defer prize selection?</DialogTitle>
          <DialogDescription>
            <strong>{winnerName}</strong> will be locked in as a winner.
            They&rsquo;ll be excluded from future draws and appear in the
            &ldquo;Pending allocation&rdquo; list — assign their prize from
            there once you know which one they chose.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "Parking…" : "Defer prize"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
