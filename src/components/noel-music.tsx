import { useEffect, useRef, useState } from "react";
import { Music, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import track from "@/assets/noel-music.mp3.asset.json";

// "Jingle Bells (Calm)" — Kevin MacLeod (incompetech.com), CC BY 3.0.
const ON_KEY = "capmoney-noel-music";
const TIME_KEY = "capmoney-noel-music-time";

/** Floating Christmas music toggle. Off by default; remembers on/off + position per device; loops. */
export function NoelMusic() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const a = new Audio(track.url);
    a.loop = true;
    a.preload = "none";
    audio.current = a;
    const saved = Number(localStorage.getItem(TIME_KEY) || 0);
    const save = () => localStorage.setItem(TIME_KEY, String(Math.floor(a.currentTime)));
    a.addEventListener("loadedmetadata", () => { if (saved > 0 && saved < a.duration) a.currentTime = saved; }, { once: true });
    a.addEventListener("timeupdate", save);
    let unlock: (() => void) | null = null;
    if (localStorage.getItem(ON_KEY) === "1") {
      setOn(true);
      a.play().catch(() => {
        // Autoplay blocked: resume on the first tap anywhere.
        unlock = () => { a.play().catch(() => {}); };
        window.addEventListener("pointerdown", unlock, { once: true });
      });
    }
    return () => {
      save();
      a.pause();
      a.removeEventListener("timeupdate", save);
      if (unlock) window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    const next = !on;
    setOn(next);
    localStorage.setItem(ON_KEY, next ? "1" : "0");
    if (next) a.play().catch(() => setOn(false));
    else { a.pause(); localStorage.setItem(TIME_KEY, String(Math.floor(a.currentTime))); }
  };

  return (
    <Button
      type="button"
      size="icon"
      variant={on ? "default" : "outline"}
      aria-label={on ? "Tắt nhạc Giáng sinh" : "Bật nhạc Giáng sinh"}
      aria-pressed={on}
      onClick={toggle}
      className="fixed right-3 top-[calc(env(safe-area-inset-top)+2.5rem)] z-30 size-10 shadow-lg"
    >
      {on ? <Pause className="size-4" /> : <Music className="size-4" />}
    </Button>
  );
}
