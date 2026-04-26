"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

interface ConfettiLayerProps {
  // Increment the key to fire a fresh burst. The first render is intentionally
  // a no-op so the burst doesn't fire on mount.
  triggerKey: number;
}

const PALETTE = ["#fef3c7", "#fcd34d", "#f59e0b", "#fde68a", "#fafaf9"];

export function ConfettiLayer({ triggerKey }: ConfettiLayerProps) {
  const initialKey = useRef(triggerKey);

  useEffect(() => {
    if (triggerKey === initialKey.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    confetti({
      particleCount: 80,
      spread: 60,
      startVelocity: 35,
      origin: { x: 0.2, y: 0.7 },
      angle: 60,
      gravity: 0.85,
      colors: PALETTE,
    });
    confetti({
      particleCount: 80,
      spread: 60,
      startVelocity: 35,
      origin: { x: 0.8, y: 0.7 },
      angle: 120,
      gravity: 0.85,
      colors: PALETTE,
    });
  }, [triggerKey]);

  return null;
}
