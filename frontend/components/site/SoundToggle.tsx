"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundEnabled, setSoundEnabled, subscribeSound } from "@/lib/audio";

export function SoundToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isSoundEnabled());
    const unsub = subscribeSound(setOn);
    return () => {
      unsub();
    };
  }, []);

  return (
    <button
      onClick={() => setSoundEnabled(!on)}
      aria-label={on ? "Mute sound" : "Enable sound"}
      title={on ? "Sound on" : "Sound off"}
      className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </button>
  );
}
