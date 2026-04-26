"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const STRIP_LENGTH = 100;
const INITIAL_INDEX = 6;
const WINNER_INDEX = 88;
const ITEM_HEIGHT_PX = 88;

const T_SPIN_UP = 2000;
const T_RACE = 3500;
const T_SLOW_DOWN = 1500;
const T_LAND = 500;
const TOTAL_MS = T_SPIN_UP + T_RACE + T_SLOW_DOWN + T_LAND;

const REDUCED_MOTION_TOTAL_MS = 3000;
const REDUCED_MOTION_NAME_COUNT = 10;
const REDUCED_MOTION_NAME_MS = REDUCED_MOTION_TOTAL_MS / REDUCED_MOTION_NAME_COUNT;

type Phase = "idle" | "spinUp" | "race" | "slowDown" | "land" | "settled";

interface NameReelProps {
  pool: string[];
  winnerName: string;
  onLanded?: () => void;
  onPhaseChange?: (phase: Phase) => void;
}

const easeInQuad = (t: number) => t * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Distance breakpoints chosen so most of the strip flies past during 'race',
// a few items decelerate during 'slowDown', and 'land' is a small bounce.
function progressAt(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= TOTAL_MS) return 1;
  const t1 = T_SPIN_UP;
  const t2 = t1 + T_RACE;
  const t3 = t2 + T_SLOW_DOWN;
  if (elapsedMs < t1) {
    return easeInQuad(elapsedMs / T_SPIN_UP) * 0.08;
  }
  if (elapsedMs < t2) {
    return 0.08 + ((elapsedMs - t1) / T_RACE) * 0.86;
  }
  if (elapsedMs < t3) {
    return 0.94 + easeOutCubic((elapsedMs - t2) / T_SLOW_DOWN) * 0.05;
  }
  return 0.99 + easeOutBack((elapsedMs - t3) / T_LAND) * 0.01;
}

function phaseAt(elapsedMs: number): Phase {
  if (elapsedMs >= TOTAL_MS) return "settled";
  if (elapsedMs < T_SPIN_UP) return "spinUp";
  if (elapsedMs < T_SPIN_UP + T_RACE) return "race";
  if (elapsedMs < T_SPIN_UP + T_RACE + T_SLOW_DOWN) return "slowDown";
  return "land";
}

function buildStrip(pool: string[], winnerName: string): string[] {
  const others = pool.filter((n) => n !== winnerName);
  const filler = others.length > 0 ? others : [winnerName];
  return Array.from({ length: STRIP_LENGTH }, (_, i) =>
    i === WINNER_INDEX ? winnerName : filler[i % filler.length]!,
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function NameReel(props: NameReelProps) {
  const reduced = useReducedMotion();
  return reduced ? <ReducedMotionReel {...props} /> : <FullMotionReel {...props} />;
}

function FullMotionReel({ pool, winnerName, onLanded, onPhaseChange }: NameReelProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const onLandedRef = useRef(onLanded);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const [phase, setPhase] = useState<Phase>("spinUp");
  const strip = useMemo(() => buildStrip(pool, winnerName), [pool, winnerName]);
  const initialOffset = -INITIAL_INDEX * ITEM_HEIGHT_PX;
  const targetOffset = -WINNER_INDEX * ITEM_HEIGHT_PX;

  // Keep the latest callback reachable from the RAF loop without making the
  // animation effect depend on it — otherwise the parent re-rendering when
  // the winner card cross-fades in would cancel and restart the reel.
  useEffect(() => {
    onLandedRef.current = onLanded;
    onPhaseChangeRef.current = onPhaseChange;
  });

  // Fire onPhaseChange once per phase transition. setPhase bails on identical
  // values, so this effect only re-runs when the phase actually changes.
  useEffect(() => {
    onPhaseChangeRef.current?.(phase);
  }, [phase]);

  useEffect(() => {
    let raf = 0;
    let landedFired = false;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const p = progressAt(elapsed);
      const offset = initialOffset + p * (targetOffset - initialOffset);
      if (stripRef.current) {
        stripRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
      }
      const newPhase = phaseAt(elapsed);
      setPhase(newPhase);
      if (newPhase === "settled") {
        if (!landedFired) {
          landedFired = true;
          onLandedRef.current?.();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [winnerName, initialOffset, targetOffset]);

  return (
    <div className="relative h-[60vh] w-full overflow-hidden">
      <FadeMasks />
      <div
        ref={stripRef}
        className={cn(
          "absolute inset-x-0 transition-[filter] duration-300 will-change-transform",
          phase === "race" && "blur-[3px]",
          phase === "slowDown" && "blur-[1px]",
        )}
        style={{
          top: `calc(50% - ${ITEM_HEIGHT_PX / 2}px)`,
          transform: `translate3d(0, ${initialOffset}px, 0)`,
        }}
      >
        {strip.map((name, i) => (
          <div
            key={i}
            className="flex items-center justify-center"
            style={{ height: `${ITEM_HEIGHT_PX}px` }}
          >
            <span
              className={cn(
                "text-5xl font-semibold tracking-tight md:text-7xl",
                i === WINNER_INDEX ? "text-amber-100" : "text-zinc-100",
              )}
            >
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReducedMotionReel({ pool, winnerName, onLanded }: NameReelProps) {
  const sequence = useMemo(() => {
    const others = pool
      .filter((n) => n !== winnerName)
      .slice(0, REDUCED_MOTION_NAME_COUNT - 1);
    return [...others, winnerName];
  }, [pool, winnerName]);
  const [index, setIndex] = useState(0);
  const onLandedRef = useRef(onLanded);

  useEffect(() => {
    onLandedRef.current = onLanded;
  });

  useEffect(() => {
    let landedFired = false;
    const interval = setInterval(() => {
      setIndex((i) => {
        if (i >= sequence.length - 1) {
          clearInterval(interval);
          if (!landedFired) {
            landedFired = true;
            onLandedRef.current?.();
          }
          return i;
        }
        return i + 1;
      });
    }, REDUCED_MOTION_NAME_MS);
    return () => clearInterval(interval);
  }, [sequence.length]);

  const isWinner = index === sequence.length - 1;
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <span
        key={index}
        className={cn(
          "animate-in fade-in text-5xl font-semibold tracking-tight duration-200 md:text-7xl",
          isWinner ? "text-amber-100" : "text-zinc-100",
        )}
      >
        {sequence[index]}
      </span>
    </div>
  );
}

function FadeMasks() {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/3 bg-gradient-to-b from-zinc-950 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-zinc-950 to-transparent" />
    </>
  );
}
