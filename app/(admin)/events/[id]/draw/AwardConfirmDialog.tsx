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
import type { PrizeForPicker } from "@/components/draw/PrizePicker";

interface Props {
  pick: PrizeForPicker | null;
  winnerName: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AwardConfirmDialog({
  pick,
  winnerName,
  pending,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Dialog open={Boolean(pick)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Award prize?</DialogTitle>
          <DialogDescription>
            Lock <strong>{pick?.name}</strong> in for{" "}
            <strong>{winnerName}</strong>?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "Locking…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
