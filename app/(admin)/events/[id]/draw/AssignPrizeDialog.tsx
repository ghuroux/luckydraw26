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
  target: { entrantDisplayName: string } | null;
  prizes: PrizeForPicker[];
  pending: boolean;
  onPick: (prize: PrizeForPicker) => void;
  onClose: () => void;
}

export function AssignPrizeDialog({
  target,
  prizes,
  pending,
  onPick,
  onClose,
}: Props) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Assign prize</DialogTitle>
          <DialogDescription>
            Pick the prize for <strong>{target?.entrantDisplayName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {prizes.map((prize) => (
            <button
              key={prize.id}
              type="button"
              disabled={pending}
              onClick={() => onPick(prize)}
              className="rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              <p className="font-medium">{prize.name}</p>
              {prize.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {prize.description}
                </p>
              )}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
