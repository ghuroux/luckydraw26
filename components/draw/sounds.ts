"use client";

import { useCallback, useEffect, useState } from "react";
import { Howl, Howler } from "howler";

const MUTED_STORAGE_KEY = "luckydraw.muted";

let sounds: {
  spinLoop: Howl;
  slowdown: Howl;
  land: Howl;
  winner: Howl;
} | null = null;

// Initialise Howl instances on first call. Howler internally caches by src
// URL, but we keep our own singleton so we don't re-create wrapper instances
// each time DrawStage mounts (every draw + every redraw).
function ensureLoaded() {
  if (sounds || typeof window === "undefined") return;
  sounds = {
    spinLoop: new Howl({
      src: ["/sounds/spin-loop.mp3"],
      loop: true,
      volume: 0.4,
      html5: false,
    }),
    slowdown: new Howl({
      src: ["/sounds/slowdown.mp3"],
      volume: 0.6,
      html5: false,
    }),
    land: new Howl({
      src: ["/sounds/land.mp3"],
      volume: 0.75,
      html5: false,
    }),
    winner: new Howl({
      src: ["/sounds/winner.mp3"],
      volume: 0.8,
      html5: false,
    }),
  };
}

type DrawPhase = "spinUp" | "race" | "slowDown" | "land" | "settled";

export function playPhase(phase: DrawPhase) {
  ensureLoaded();
  if (!sounds) return;
  switch (phase) {
    case "spinUp":
      sounds.spinLoop.play();
      break;
    case "race":
      // No-op — spin loop continues from spinUp.
      break;
    case "slowDown":
      sounds.spinLoop.fade(sounds.spinLoop.volume(), 0, 700);
      sounds.spinLoop.once("fade", () => sounds?.spinLoop.stop());
      sounds.slowdown.play();
      break;
    case "land":
      sounds.land.play();
      break;
    case "settled":
      sounds.winner.play();
      break;
  }
}

// Hard stop — used when the operator dismisses mid-animation.
export function stopAllSounds() {
  if (!sounds) return;
  sounds.spinLoop.stop();
  sounds.slowdown.stop();
  sounds.land.stop();
  sounds.winner.stop();
}

export function useMuted(): [boolean, (next: boolean) => void] {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    ensureLoaded();
    const stored = localStorage.getItem(MUTED_STORAGE_KEY) === "true";
    setMutedState(stored);
    Howler.mute(stored);
  }, []);

  const setMuted = useCallback((next: boolean) => {
    setMutedState(next);
    Howler.mute(next);
    localStorage.setItem(MUTED_STORAGE_KEY, String(next));
  }, []);

  return [muted, setMuted];
}
