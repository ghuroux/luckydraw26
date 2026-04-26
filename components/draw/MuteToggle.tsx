"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useMuted } from "./sounds";

export function MuteToggle() {
  const [muted, setMuted] = useMuted();
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "Unmute" : "Mute"}
      title={muted ? "Unmute" : "Mute"}
      className="absolute right-6 top-6 z-30 flex size-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-400 backdrop-blur transition-colors hover:bg-zinc-900/80 hover:text-zinc-200"
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  );
}
