import { Link, useRouterState } from "@tanstack/react-router";
import { Home, PieChart, ReceiptText, CreditCard, User, Plus, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { useComposer } from "./composer";
import { useOnline } from "@/hooks/use-online";
import { useWallets } from "@/lib/data";
import { cn } from "@/lib/utils";
import { PullToRefresh } from "./pull-to-refresh";

const TABS = [
  { to: "/", label: "Trang chủ", icon: Home },
  { to: "/reports", label: "Báo cáo", icon: PieChart },
  { to: "/transactions", label: "Giao dịch", icon: ReceiptText },
  { to: "/wallets", label: "Ví", icon: CreditCard },
  { to: "/profile", label: "Cá nhân", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const online = useOnline();
  const { openNew } = useComposer();
  const { data: wallets } = useWallets();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hasWallet = (wallets ?? []).some((w) => !w.archived_at);
  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r bg-sidebar p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2 text-lg font-bold">
          <img src="/icon-192.png" alt="" className="size-8 rounded-lg" /> CapMoney
        </div>
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm", isActive(t.to) ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent")}>
            <t.icon className="size-5" /> {t.label}
          </Link>
        ))}
        {online && hasWallet && (
          <button onClick={() => openNew()} className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground">
            <Plus className="size-5" /> Ghi giao dịch
          </button>
        )}
      </aside>

      {online && <PullToRefresh />}
      <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[max(0.25rem,env(safe-area-inset-top))] md:pb-10">
        {online ? children : <Offline />}
      </main>

      {online && hasWallet && (
        <button aria-label="Ghi giao dịch" onClick={() => openNew()}
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-5 z-30 grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-fab md:hidden">
          <Plus className="size-8" />
        </button>
      )}

      <nav aria-label="Điều hướng chính" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 md:hidden">
        <div className="glass-nav mx-auto flex max-w-md items-center justify-between rounded-full p-1.5">
          {TABS.map((t) => (
            <Link key={t.to} to={t.to} aria-label={t.label}
              className={cn("flex min-h-12 flex-1 flex-col items-center justify-center rounded-full text-[10px]", isActive(t.to) ? "bg-background/60 text-primary" : "text-muted-foreground")}>
              <t.icon className="size-6" />
              <span className="sr-only sm:not-sr-only">{t.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Offline() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-muted"><WifiOff className="size-8 text-muted-foreground" /></div>
      <h1 className="text-xl font-semibold">Không có kết nối internet</h1>
      <p className="max-w-xs text-sm text-muted-foreground">CapMoney chỉ hiển thị và lưu dữ liệu tài chính khi có mạng. Không có dữ liệu nào được lưu trên máy. Hãy kết nối lại để tiếp tục.</p>
    </div>
  );
}

export function PageHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-5">
      <h1 className="text-2xl font-bold">{title}</h1>
      {right}
    </div>
  );
}

export function Empty({ title, body, action, icon }: { title: string; body: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-3xl bg-surface p-7 text-center">
      {icon && <div className="mb-2 grid size-14 place-items-center rounded-full bg-surface-2 text-muted-foreground">{icon}</div>}
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
