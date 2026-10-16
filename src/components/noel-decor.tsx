import { useEffect, useState } from "react";
import { NoelMusic } from "@/components/noel-music";

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
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
        <StringLights />
        {FLAKES.map((f, i) => (
          <span key={i} className="snowflake" style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }} />
        ))}
      </div>
      <NoelMusic />
    </>
  );
}

const BULBS = ["oklch(0.5 0.14 15)", "oklch(0.55 0.11 150)", "oklch(0.85 0.12 85)", "oklch(0.97 0.01 90)"];

/** Thin sagging wire with small round bulbs. */
function StringLights() {
  const n = 11;
  const pts = Array.from({ length: n }, (_, i) => {
    const x = 20 + (i * 360) / (n - 1);
    const t = (x % 120) / 120;
    return { x, y: 6 + 10 * Math.sin(Math.PI * t) };
  });
  return (
    <svg viewBox="0 0 400 32" preserveAspectRatio="none" className="absolute inset-x-0 top-[env(safe-area-inset-top)] mx-auto h-8 w-full max-w-3xl">
      <path d="M0 6 Q60 26 120 6 T240 6 T360 6 T480 6" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" vectorEffect="non-scaling-stroke" className="text-foreground" />
      {pts.map((p, i) => (
        <circle key={i} className="bulb" cx={p.x} cy={p.y + 3} r="2.6" fill={BULBS[i % 4]} style={{ animationDelay: `${(i * 0.7) % 3.6}s` }} />
      ))}
    </svg>
  );
}

/** Small Santa hat sitting level on top of a logo/avatar. */
export function SantaHat({ className = "" }: { className?: string }) {
  const on = useNoel();
  if (!on) return null;
  return (
    <svg aria-hidden viewBox="0 0 64 44" className={`pointer-events-none absolute ${className}`}>
      <path d="M12 34 C14 16 26 6 38 6 C48 6 54 12 56 22 L50 24 C48 18 45 16 42 16 L52 34 Z" fill="oklch(0.5 0.14 15)" />
      <circle cx="54" cy="24" r="5" fill="oklch(0.98 0 0)" />
      <rect x="8" y="32" width="48" height="9" rx="4.5" fill="oklch(0.98 0 0)" />
    </svg>
  );
}

/** App logo with the Santa hat (shown when Noel is active), used on the sign-in screen. */
export function FestiveLogo() {
  return (
    <div className="relative mb-4 size-16">
      <img src="/icon-192.png?v=2" alt="" className="size-16 rounded-2xl object-cover" />
      <SantaHat className="-top-6 left-1/2 w-12 -translate-x-1/2" />
    </div>
  );
}
