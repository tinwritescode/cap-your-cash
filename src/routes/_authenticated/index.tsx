import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Eye, EyeOff, Images, Undo2, ShoppingCart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCategories, useMonthSummary, useMonthTx, useProfile, useWallets, type TxWithPhotos } from "@/lib/data";
import { dayKey, daysInMonth, toLocal } from "@/lib/finance";
import { Money, usePrefs } from "@/lib/ui-prefs";
import { BudgetCard } from "@/components/budget-card";
import { PhotoThumb } from "@/components/photo";
import { TxRow } from "@/components/tx-row";
import { Onboarding } from "@/components/onboarding";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Trang chủ — CapMoney" },
      { name: "description", content: "Lịch chi tiêu bằng ảnh, tổng thu chi và ngân sách tháng." },
      { property: "og:title", content: "Trang chủ — CapMoney" },
      { property: "og:description", content: "Lịch chi tiêu bằng ảnh và ngân sách tháng." },
    ],
  }),
  component: Home,
});

function greeting(h: number) {
  if (h < 11) return "Chào buổi sáng ☀️";
  if (h < 14) return "Chào buổi trưa 🌤️";
  if (h < 18) return "Chào buổi chiều 🌇";
  if (h < 22) return "Chào buổi tối 🌆";
  return "Chúc ngủ ngon 🌙";
}

function Home() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: wallets } = useWallets();
  const { data: categories = [] } = useCategories();
  const { hidden, toggle } = usePrefs();
  const now = toLocal(new Date());
  const [ym, setYm] = useState({ y: now.y, m: now.m });
  const [wallet, setWallet] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "day">("month");
  const [openDay, setOpenDay] = useState<string | null>(null);

  const summary = useMonthSummary(ym.y, ym.m, wallet);
  const curSummary = useMonthSummary(now.y, now.m, null);
  const monthTx = useMonthTx(ym.y, ym.m);
  const nowTx = useMonthTx(now.y, now.m);

  const filtered = useMemo(
    () => (monthTx.data ?? []).filter((t) => !wallet || t.source_wallet_id === wallet || t.dest_wallet_id === wallet),
    [monthTx.data, wallet],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, TxWithPhotos[]>();
    for (const t of filtered) {
      const k = dayKey(t.occurred_at);
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return m;
  }, [filtered]);

  const todayKey = dayKey(new Date());
  const todaySpent = (nowTx.data ?? []).filter((t) => t.type === "expense" && dayKey(t.occurred_at) === todayKey).reduce((s, t) => s + Number(t.amount_vnd), 0);

  if (wallets && wallets.length === 0) return <Onboarding />;

  const shift = (d: number) => setYm(({ y, m }) => { const t = y * 12 + (m - 1) + d; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; });
  const name = profile?.display_name || user?.email?.split("@")[0];
  const firstDow = (new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const nDays = daysInMonth(ym.y, ym.m);
  const isCurrent = ym.y === now.y && ym.m === now.m;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground">{greeting(now.hh)}</p>
          <h1 className="text-3xl font-bold">{name}</h1>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-destructive/15 px-3 py-1 text-sm text-expense">
            <ShoppingCart className="size-4" /> Đã chi <Money value={todaySpent} /> hôm nay
          </p>
        </div>
        <button onClick={toggle} aria-label={hidden ? "Hiện số tiền" : "Ẩn số tiền"} className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          {hidden ? <EyeOff /> : <Eye />}
        </button>
      </header>

      <div className="flex items-center gap-2">
        <div className="flex rounded-full bg-surface p-1">
          {(["day", "month"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
              className={cn("min-h-11 rounded-full px-5 text-sm", view === v ? "bg-surface-2 font-semibold" : "text-muted-foreground")}>
              {v === "day" ? "Ngày" : "Tháng"}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Link to="/transactions" search={{ view: "gallery" }} aria-label="Thư viện ảnh" className="grid size-11 place-items-center rounded-full bg-accent text-accent-foreground"><Images className="size-5" /></Link>
      </div>

      <BudgetCard y={now.y} m={now.m} spent={curSummary.data?.allExpense ?? 0} budget={curSummary.data?.budget ?? null} />

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<ArrowUpRight />} tone="expense" label="Chi" value={summary.data?.expense ?? 0} />
        <StatCard icon={<ArrowDownLeft />} tone="income" label="Thu" value={summary.data?.income ?? 0} />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={!wallet} onClick={() => setWallet(null)}>Tất cả</Chip>
        {(wallets ?? []).filter((w) => !w.archived_at).map((w) => (
          <Chip key={w.id} active={wallet === w.id} onClick={() => setWallet(w.id)}>{w.name}</Chip>
        ))}
      </div>

      <div className="flex items-center rounded-2xl bg-surface p-1">
        <button aria-label="Tháng trước" onClick={() => shift(-1)} className="grid size-11 place-items-center text-primary"><ChevronLeft /></button>
        <p className="flex-1 text-center text-lg font-semibold">tháng {ym.m} {ym.y}</p>
        {!isCurrent && <button aria-label="Về tháng này" onClick={() => setYm({ y: now.y, m: now.m })} className="grid size-11 place-items-center rounded-full bg-accent text-accent-foreground"><Undo2 className="size-4" /></button>}
        <button aria-label="Tháng sau" onClick={() => shift(1)} className="grid size-11 place-items-center text-primary"><ChevronRight /></button>
      </div>

      {monthTx.isError && <p className="text-sm text-destructive">Không tải được dữ liệu. Kiểm tra kết nối và thử lại.</p>}

      {view === "month" ? (
        <div className="rounded-3xl bg-surface p-3">
          <div className="mb-2 grid grid-cols-7 text-center text-xs text-muted-foreground">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-3">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: nDays }).map((_, i) => {
              const d = i + 1;
              const k = `${ym.y}-${String(ym.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              return <DayCell key={k} day={d} isToday={k === todayKey} txs={byDay.get(k) ?? []} categories={categories} onOpen={() => setOpenDay(k)} />;
            })}
          </div>
        </div>
      ) : (
        <DayList txs={isCurrent ? byDay.get(todayKey) ?? [] : filtered} label={isCurrent ? "Hôm nay" : `Tháng ${ym.m}`} />
      )}

      <Dialog open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent className="max-h-[80dvh] overflow-y-auto rounded-3xl bg-surface">
          <DialogTitle>{openDay?.split("-").reverse().join("/")}</DialogTitle>
          {(byDay.get(openDay ?? "") ?? []).map((t) => <TxRow key={t.id} tx={t} categories={categories} wallets={wallets ?? []} />)}
          {(byDay.get(openDay ?? "") ?? []).length === 0 && <p className="text-sm text-muted-foreground">Không có giao dịch.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );

  function DayList({ txs, label }: { txs: TxWithPhotos[]; label: string }) {
    return (
      <div className="rounded-3xl bg-surface p-2">
        <p className="px-2 py-1 text-sm text-muted-foreground">{label}</p>
        {txs.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Chưa có giao dịch. Bấm + để ghi.</p> : txs.map((t) => <TxRow key={t.id} tx={t} categories={categories} wallets={wallets ?? []} />)}
      </div>
    );
  }
}

function StatCard({ icon, tone, label, value }: { icon: React.ReactNode; tone: "expense" | "income"; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-surface p-4">
      <div className={cn("grid size-10 shrink-0 place-items-center rounded-full", tone === "expense" ? "bg-expense text-primary-foreground" : "bg-income text-primary-foreground")}>{icon}</div>
      <div className="min-w-0">
        <Money value={value} className="block truncate text-lg font-bold" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cn("min-h-11 shrink-0 rounded-full px-5 text-sm", active ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground")}>
      {children}
    </button>
  );
}

function DayCell({ day, isToday, txs, categories, onOpen }: { day: number; isToday: boolean; txs: TxWithPhotos[]; categories: { id: string; icon: string }[]; onOpen: () => void }) {
  const items = txs.slice(0, 2);
  const extra = txs.length - items.length;
  return (
    <button onClick={onOpen} aria-label={`Ngày ${day}, ${txs.length} giao dịch`} className="flex flex-col items-center gap-1">
      <div className="relative h-12 w-12">
        {items.length === 0 && <div className="size-full" />}
        {items.map((t, i) => {
          const p = t.transaction_photos?.slice().sort((a, b) => a.sort_order - b.sort_order)[0];
          const icon = categories.find((c) => c.id === t.category_id)?.icon ?? (t.type === "transfer" ? "⇄" : "📷");
          return (
            <div key={t.id} className={cn("absolute size-10 overflow-hidden rounded-xl border-2 border-foreground/80 bg-surface-2", i === 0 ? "left-0 top-0" : "bottom-0 right-0")}>
              {p ? <PhotoThumb path={p.thumb_path} className="size-full" /> : <span className="grid size-full place-items-center text-lg">{icon}</span>}
            </div>
          );
        })}
        {extra > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-surface-2 px-1.5 text-[10px] font-semibold">+{extra}</span>}
      </div>
      <span className={cn("text-sm", isToday && "rounded-full bg-primary px-2 text-primary-foreground")}>{day}</span>
    </button>
  );
}
