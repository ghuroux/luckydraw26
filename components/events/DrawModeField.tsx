"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type DrawMode = "PRIZE_DRAW" | "WINNER_DRAW";

interface Option {
  value: DrawMode;
  title: string;
  description: string;
}

const OPTIONS: Option[] = [
  {
    value: "PRIZE_DRAW",
    title: "Draw prizes",
    description:
      "Each prize is drawn separately — the reel reveals the winner of that specific prize.",
  },
  {
    value: "WINNER_DRAW",
    title: "Draw winners",
    description:
      "Winners are drawn one at a time and pick from the remaining prizes when they reach the stage.",
  },
];

interface Props {
  value: DrawMode;
  onChange: (value: DrawMode) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export function DrawModeField({
  value,
  onChange,
  disabled = false,
  disabledReason,
}: Props) {
  return (
    <div className="space-y-2">
      <Label>Draw mode</Label>
      <div
        role="radiogroup"
        aria-label="Draw mode"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                selected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-foreground/30",
                disabled && "cursor-not-allowed opacity-60 hover:border-border",
              )}
            >
              <div className="font-medium">{option.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
      {disabled && disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
    </div>
  );
}
