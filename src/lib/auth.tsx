import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = { user: User | null; loading: boolean };
const Ctx = createContext<AuthCtx>({ user: null, loading: true });

// Listeners notified when the signed-in account changes (used to drop in-memory drafts).
const accountChangeListeners = new Set<() => void>();
export function onAccountChange(fn: () => void) {
  accountChangeListeners.add(fn);
  return () => accountChangeListeners.delete(fn);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthCtx>({ user: null, loading: true });
  const qc = useQueryClient();
  const lastUid = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const apply = (user: User | null) => {
      const uid = user?.id ?? null;
      if (lastUid.current !== undefined && lastUid.current !== uid) {
        // Account changed: drop every cached financial record, signed URL and pending submission.
        qc.clear();
        accountChangeListeners.forEach((f) => f());
      }
      lastUid.current = uid;
      setState({ user, loading: false });
    };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      apply(session?.user ?? null);
    });
    supabase.auth.getUser().then(({ data: d }) => apply(d.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [qc]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
