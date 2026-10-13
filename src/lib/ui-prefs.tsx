import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { useProfile } from "./data";
import { formatVnd } from "./finance";
import { cn } from "./utils";

// Display preference only (not access control). Persisted on the profile row.
type Prefs = { hidden: boolean; toggle: () => void };
const Ctx = createContext<Prefs>({ hidden: false, toggle: () => {} });

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (profile) setHidden(profile.hide_amounts);
  }, [profile]);
  useEffect(() => {
    const light = profile?.theme === "light";
    document.documentElement.classList.toggle("light", light);
  }, [profile?.theme]);
  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    if (user) supabase.from("profiles").update({ hide_amounts: next }).eq("id", user.id).then();
  };
  return <Ctx.Provider value={{ hidden, toggle }}>{children}</Ctx.Provider>;
}
export const usePrefs = () => useContext(Ctx);

export function Money({ value, className, sign }: { value: number; className?: string; sign?: "+" | "-" }) {
  const { hidden } = usePrefs();
  return (
    <span className={cn("tabular-nums", hidden && "amount-hidden", className)} aria-label={hidden ? "Số tiền đã ẩn" : undefined}>
      {hidden ? "••••••" : `${sign && value !== 0 ? sign : ""}${formatVnd(value)}`}
    </span>
  );
}
