import { useEffect, useState } from "react";
import garland from "@/assets/noel-garland.png";

/** True when the Noel accent is active (class set on <html> by applyAccent). */
export function useNoel() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setOn(el.classList.contains("noel"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return on;
}

const FLAKES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 3 + ((i * 7) % 5),
  dur: 9 + ((i * 13) % 10),
  delay: -((i * 11) % 18),
}));

/** Decorative only: garland on top, gentle snowfall. Hidden from screen readers, ignores taps. */
export function NoelDecor() {
  const on = useNoel();
  if (!on) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      <img src={garland} alt="" className="absolute inset-x-0 top-[env(safe-area-inset-top)] mx-auto h-14 w-full max-w-3xl object-contain object-top opacity-90 md:h-20" />
      {FLAKES.map((f, i) => (
        <span key={i} className="snowflake" style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }} />
      ))}
    </div>
  );
}

/** Small Santa hat placed over a logo/avatar corner. */
export function SantaHat({ className = "" }: { className?: string }) {
  const on = useNoel();
  if (!on) return null;
  return (
    <svg aria-hidden viewBox="0 0 64 48" className={`pointer-events-none absolute ${className}`}>
      <path d="M8 38 C14 14 34 2 52 10 L46 34 Z" fill="oklch(0.55 0.2 25)" />
      <circle cx="54" cy="10" r="6" fill="oklch(0.98 0 0)" />
      <rect x="4" y="34" width="46" height="10" rx="5" fill="oklch(0.98 0 0)" />
    </svg>
  );
}
