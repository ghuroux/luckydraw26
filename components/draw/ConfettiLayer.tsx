"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

interface ConfettiLayerProps {
  // Increment the key to fire a fresh sequence. The first render is
  // intentionally a no-op so the burst doesn't fire on mount.
  triggerKey: number;
}

// Warm celebration palette — three depths of gold + white sparkle.
// Used for both the opening salvo and the sustained fireworks shower.
const PALETTE = [
  "#fbbf24", // amber-400
  "#f59e0b", // amber-500
  "#d97706", // amber-600
  "#fde68a", // amber-200
  "#fef3c7", // amber-100
  "#fef9c3", // yellow-100
  "#ffffff", // pure white sparkle
];

const FIREWORKS_DURATION_MS = 5000;
const FIREWORKS_INTERVAL_MS = 240;

export function ConfettiLayer({ triggerKey }: ConfettiLayerProps) {
  const initialKey = useRef(triggerKey);

  useEffect(() => {
    if (triggerKey === initialKey.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Track every timer/interval we kick off so we can cancel them if the
    // component unmounts mid-show (operator dismisses, page navigates).
    const timers: ReturnType<typeof setTimeout>[] = [];
    let interval: ReturnType<typeof setInterval> | null = null;

    // ── 1. Opening salvo ───────────────────────────────────────────────
    // Two big angled bursts from the lower corners — the rocket launch.
    confetti({
      particleCount: 110,
      spread: 70,
      startVelocity: 50,
      origin: { x: 0.15, y: 0.8 },
      angle: 60,
      gravity: 0.9,
      scalar: 1.1,
      ticks: 220,
      shapes: ["circle", "square"],
      colors: PALETTE,
    });
    confetti({
      particleCount: 110,
      spread: 70,
      startVelocity: 50,
      origin: { x: 0.85, y: 0.8 },
      angle: 120,
      gravity: 0.9,
      scalar: 1.1,
      ticks: 220,
      shapes: ["circle", "square"],
      colors: PALETTE,
    });

    // ── 2. Sustained fireworks shower ──────────────────────────────────
    // Random bursts at random sky positions, varying density. Particle count
    // tapers off as time runs out so the show feels like it's "winding down"
    // rather than abruptly stopping.
    const showStart = performance.now();
    interval = setInterval(() => {
      const elapsed = performance.now() - showStart;
      const remaining = FIREWORKS_DURATION_MS - elapsed;
      if (remaining <= 0) {
        if (interval) clearInterval(interval);
        return;
      }
      // Density decays from full (60) to a trickle (15) as we approach end.
      const density = Math.max(15, Math.round(60 * (remaining / FIREWORKS_DURATION_MS)));

      // Two bursts per tick, mirrored across the sky for symmetry without
      // looking artificial.
      const baseY = randomBetween(0.1, 0.45);
      confetti({
        particleCount: density,
        spread: randomBetween(60, 100),
        startVelocity: randomBetween(28, 42),
        origin: { x: randomBetween(0.1, 0.45), y: baseY },
        gravity: 1.0,
        scalar: randomBetween(0.8, 1.1),
        ticks: 180,
        shapes: ["circle", "star"],
        colors: PALETTE,
      });
      confetti({
        particleCount: density,
        spread: randomBetween(60, 100),
        startVelocity: randomBetween(28, 42),
        origin: { x: randomBetween(0.55, 0.9), y: baseY + randomBetween(-0.1, 0.1) },
        gravity: 1.0,
        scalar: randomBetween(0.8, 1.1),
        ticks: 180,
        shapes: ["circle", "star"],
        colors: PALETTE,
      });
    }, FIREWORKS_INTERVAL_MS);

    // ── 3. Centred finale ──────────────────────────────────────────────
    // Big slow-fall fountain just as the shower ends. Stars + slow gravity
    // keeps the moment open for a beat before the room comes back.
    timers.push(
      setTimeout(() => {
        confetti({
          particleCount: 160,
          spread: 130,
          startVelocity: 55,
          origin: { x: 0.5, y: 0.55 },
          gravity: 0.7,
          scalar: 1.2,
          ticks: 260,
          shapes: ["star", "circle"],
          colors: PALETTE,
        });
      }, FIREWORKS_DURATION_MS),
    );

    return () => {
      if (interval) clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [triggerKey]);

  return null;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
