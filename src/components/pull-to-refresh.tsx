import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 70;
const MAX = 110;

/** Pull down from the top of the page to refetch all server data (no local caching involved). */
export function PullToRefresh() {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const blocked = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest('[role="dialog"],[role="alertdialog"],[data-radix-popper-content-wrapper],input,textarea');
    const onStart = (e: TouchEvent) => {
      if (busy || window.scrollY > 0 || blocked(e.target) || document.querySelector('[role="dialog"]')) { start.current = null; return; }
      start.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current == null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) { pullRef.current = 0; setPull(0); return; }
      const v = Math.min(MAX, dy * 0.5);
      pullRef.current = v; setPull(v);
      if (e.cancelable) e.preventDefault();
    };
    const onEnd = async () => {
      if (start.current == null) return;
      start.current = null;
      if (pullRef.current >= THRESHOLD) {
        setBusy(true); setPull(THRESHOLD);
        try { await qc.refetchQueries({ type: "active" }); } finally {
          setBusy(false); pullRef.current = 0; setPull(0);
        }
      } else { pullRef.current = 0; setPull(0); }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [qc, busy]);

  if (pull === 0 && !busy) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
      style={{ transform: `translateY(calc(env(safe-area-inset-top, 0px) + ${pull - 44}px))`, transition: start.current == null ? "transform 200ms" : "none" }}>
      <div className="grid size-10 place-items-center rounded-full border bg-surface-2 text-primary">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowDown className={cn("size-5 transition-transform", ready && "rotate-180")} style={{ opacity: Math.min(1, pull / THRESHOLD) }} />}
        <span className="sr-only">{busy ? "Đang làm mới" : ready ? "Thả để làm mới" : "Kéo để làm mới"}</span>
      </div>
    </div>
  );
}
