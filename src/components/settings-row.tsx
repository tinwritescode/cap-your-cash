import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** One tappable row in a settings list; renders a link when `to` is given. */
export function SettingsRow({ icon, label, children, to }: { icon: ReactNode; label: string; children: ReactNode; to?: "/trash" | "/transactions" | "/agents" }) {
  const cls = "flex min-h-14 items-center gap-3 rounded-2xl px-3 hover:bg-surface-2";
  const inner = (
    <>
      <span className="text-muted-foreground [&_svg]:size-5">{icon}</span>
      <span className="flex-1">{label}</span>
      {children}
    </>
  );
  return to ? <Link to={to} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
