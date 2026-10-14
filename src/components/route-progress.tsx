import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Thin top bar shown while the router is resolving a navigation. */
export function RouteProgress() {
  const loading = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading) {
      setVisible(true);
      setWidth(15);
      const id = setInterval(() => setWidth((w) => (w < 85 ? w + (90 - w) * 0.12 : w)), 120);
      return () => clearInterval(id);
    }
    setWidth(100);
    const t = setTimeout(() => { setVisible(false); setWidth(0); }, 250);
    return () => clearTimeout(t);
  }, [loading]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-[60] h-[3px]" style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms" }}>
      <div className="h-full rounded-r-full bg-primary shadow-fab" style={{ width: `${width}%`, transition: "width 200ms ease-out" }} />
    </div>
  );
}

/** Generic page skeleton used while a route is pending. */
export function PagePending() {
  return (
    <div className="fade-in mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-5">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
      </div>
      <Skeleton className="h-64 rounded-3xl" />
      <Skeleton className="h-16 rounded-3xl" />
    </div>
  );
}
