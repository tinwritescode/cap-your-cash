import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { setSoundEnabled, soundEnabled } from "@/lib/sound";

/** Toggle for tap sounds; reads device preference after hydration. */
export function SoundSwitch() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundEnabled()), []);
  return <Switch aria-label="Âm thanh khi bấm" checked={on} onCheckedChange={(v) => { setOn(v); setSoundEnabled(v); }} />;
}
