"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";
import { playPhase, stopAllSounds, useMuted } from "./sounds";

// Mirrors NameReel TOTAL_MS so the operator console's progress / unlock timing
// matches what the audience sees on the projector.
const REEL_DURATION_MS = 7500;

interface OperatorRevealProps {
  /** Bumped on each draw/redraw to re-trigger the timeline. */
  attempt: number;
  winnerName: string;
  winnerTicket?: number;
  /** Eyebrow above the name. For PRIZE_DRAW: the prize. For WINNER_DRAW: the
      awarded prize once chosen. */
  prizeName?: string;
  isTest?: boolean;
  /** Optional banner shown above the card (e.g. eligibility-reset notice). */
  banner?: React.ReactNode;
  /** Renders below the winner. Receives a `revealComplete` flag so the parent
      can swap content (e.g. show the prize picker only after the audience sees
      the reveal). */
  children: (revealComplete: boolean) => React.ReactNode;
}

export function OperatorReveal({
  attempt,
  winnerName,
  winnerTicket,
  prizeName,
  isTest,
  banner,
  children,
}: OperatorRevealProps) {
  const [revealComplete, setRevealComplete] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(REEL_DURATION_MS / 1000),
  );
  const [muted, setMuted] = useMuted();

  // Re-run the timeline on every new attempt. Sound playback mirrors the
  // NameReel phase progression (spinUp → race → slowDown → land → settled)
  // so the room hears the build-up even though the operator UI doesn't reel.
  useEffect(() => {
    setRevealComplete(false);
    setSecondsLeft(Math.ceil(REEL_DURATION_MS / 1000));

    playPhase("spinUp");
    const tRace = setTimeout(() => playPhase("race"), 2000);
    const tSlow = setTimeout(() => playPhase("slowDown"), 5500);
    const tLand = setTimeout(() => playPhase("land"), 7000);
    const tDone = setTimeout(() => {
      playPhase("settled");
      setRevealComplete(true);
    }, REEL_DURATION_MS);

    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => {
      clearTimeout(tRace);
      clearTimeout(tSlow);
      clearTimeout(tLand);
      clearTimeout(tDone);
      clearInterval(interval);
    };
  }, [attempt]);

  // Cut audio if the operator dismisses mid-roll.
  useEffect(() => () => stopAllSounds(), []);

  return (
    <div className="space-y-3">
      {banner}

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
        {/* Status bar */}
        <div
          className={cn(
            "flex items-center justify-between border-b px-5 py-3 transition-colors",
            revealComplete
              ? "border-foreground/8 bg-celebration-soft/30"
              : "border-foreground/8 bg-surface-sunken",
          )}
        >
          <div className="flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.18em]">
            {revealComplete ? (
              <>
                <Check
                  className="size-3.5"
                  style={{ color: "var(--celebration)" }}
                />
                <span className="text-foreground">
                  {isTest ? "Test reveal complete" : "Reveal complete"}
                </span>
              </>
            ) : (
              <>
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">
                  {isTest ? "Test reel rolling" : "Audience reel rolling"}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {!revealComplete && (
              <span className="font-mono tabular-nums">{secondsLeft}s</span>
            )}
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              aria-label={muted ? "Unmute" : "Mute"}
              title={muted ? "Unmute" : "Mute"}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {muted ? (
                <VolumeX className="size-3.5" />
              ) : (
                <Volume2 className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-7">
          {prizeName && (
            <p
              className="text-xs font-medium uppercase tracking-[0.22em]"
              style={{
                color: "color-mix(in oklch, var(--celebration) 55%, var(--foreground))",
              }}
            >
              {prizeName}
            </p>
          )}
          <div
            className={cn(
              "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2",
              prizeName && "mt-3",
            )}
          >
            <p className="text-display-xs font-semibold tracking-tight text-foreground md:text-display-sm">
              {winnerName}
            </p>
            {winnerTicket !== undefined && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 ring-1 ring-inset ring-foreground/8">
                <Sparkles
                  className="size-3.5"
                  style={{ color: "var(--celebration)" }}
                />
                <span className="font-mono text-sm tabular-nums text-foreground">
                  #{winnerTicket}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Actions slot */}
        <div className="border-t border-foreground/8 bg-surface-sunken/60 px-5 py-4">
          {!revealComplete && (
            <p className="mb-3 text-xs text-muted-foreground">
              Actions unlock once the audience sees the reveal
              {isTest ? "" : " on the projector"}.
            </p>
          )}
          {children(revealComplete)}
        </div>
      </div>
    </div>
  );
}
