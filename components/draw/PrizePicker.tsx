"use client";

import { cn } from "@/lib/utils";

const TAP =
  "select-none [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

export interface PrizeForPicker {
  id: string;
  name: string;
  description?: string | null;
}

interface Props {
  prizes: PrizeForPicker[];
  onPick: (prize: PrizeForPicker) => void;
  disabled?: boolean;
}

export function PrizePicker({ prizes, onPick, disabled = false }: Props) {
  if (prizes.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        All prizes have been awarded — the draw is complete.
      </p>
    );
  }
  return (
    <div className="grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {prizes.map((prize) => (
        <button
          key={prize.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(prize)}
          className={cn(
            TAP,
            "rounded-xl border border-amber-100/20 bg-zinc-900/60 px-5 py-4 text-left backdrop-blur-md transition-colors",
            "hover:border-amber-200/60 hover:bg-zinc-900/80",
            disabled && "cursor-not-allowed opacity-50 hover:border-amber-100/20 hover:bg-zinc-900/60",
          )}
        >
          <p className="text-base font-medium text-amber-50">{prize.name}</p>
          {prize.description && (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
              {prize.description}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
