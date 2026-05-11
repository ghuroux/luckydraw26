"use client";

import { cn } from "@/lib/utils";

const TAP =
  "select-none [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export interface PrizeForOperatorPicker {
  id: string;
  name: string;
  description?: string | null;
}

interface Props {
  prizes: PrizeForOperatorPicker[];
  onPick: (prize: PrizeForOperatorPicker) => void;
  disabled?: boolean;
}

/**
 * Light-themed prize picker for the operator console (in-flow card, not the
 * dark presentation overlay). Same affordance as the audience-side
 * PrizePicker, themed for the admin surface.
 */
export function OperatorPrizePicker({ prizes, onPick, disabled = false }: Props) {
  if (prizes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        All prizes have been awarded — the draw is complete.
      </p>
    );
  }
  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {prizes.map((prize) => (
        <button
          key={prize.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(prize)}
          className={cn(
            TAP,
            "rounded-xl border border-border bg-background px-4 py-4 text-left transition-all",
            "hover:border-foreground/20 hover:bg-muted/50 hover:shadow-xs",
            disabled && "cursor-not-allowed opacity-50 hover:border-border hover:bg-background hover:shadow-none",
          )}
        >
          <p className="text-base font-medium text-foreground">{prize.name}</p>
          {prize.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {prize.description}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
