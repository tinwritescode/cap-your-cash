import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Opts = { title: string; body?: string; ok?: string; cancel?: string; destructive?: boolean };
const Ctx = createContext<(o: Opts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(Ctx);

/** Styled replacement for window.confirm(). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Opts | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const ask = useCallback((o: Opts) => new Promise<boolean>((res) => { resolver.current = res; setOpts(o); }), []);
  const done = (v: boolean) => { resolver.current(v); setOpts(null); };
  return (
    <Ctx.Provider value={ask}>
      {children}
      <AlertDialog open={!!opts} onOpenChange={(o) => !o && done(false)}>
        <AlertDialogContent className="rounded-3xl bg-surface sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.body && <AlertDialogDescription>{opts.body}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="mt-0 h-12 flex-1 rounded-2xl" onClick={() => done(false)}>{opts?.cancel ?? "Huỷ"}</AlertDialogCancel>
            <AlertDialogAction className={`h-12 flex-1 rounded-2xl ${opts?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`} onClick={() => done(true)}>{opts?.ok ?? "Đồng ý"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}
