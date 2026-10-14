import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, List, Images, Loader2, SearchX, Camera } from "lucide-react";
import { useComposer } from "@/components/composer";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCategories, useWallets, type TxWithPhotos, type Photo, type Tx } from "@/lib/data";
import { csvCell, fromLocalInput, isoWithOffset } from "@/lib/finance";
import { Money } from "@/lib/ui-prefs";
import { PageHeader, Empty } from "@/components/shell";
import { TxRow } from "@/components/tx-row";
import { PhotoThumb } from "@/components/photo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppSelect, DatePicker } from "@/components/pickers";

const search = z.object({ view: z.enum(["list", "gallery"]).optional() });

export const Route = createFileRoute("/_authenticated/transactions")({
  staticData: { sitemap: false },
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Giao dịch — CapMoney" },
      { name: "description", content: "Danh sách giao dịch và thư viện ảnh chi tiêu, tìm kiếm và lọc." },
      { property: "og:title", content: "Giao dịch — CapMoney" },
      { property: "og:description", content: "Danh sách giao dịch và thư viện ảnh." },
    ],
  }),
  component: TxPage,
});

type Filters = { q: string; from: string; to: string; type: string; wallet: string; category: string };
const PAGE = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(q: any, f: Filters, p = "") {
  q = q.is(`${p}deleted_at`, null);
  if (f.q.trim()) q = q.ilike(`${p}note`, `%${f.q.trim().replace(/[%_]/g, "")}%`);
  if (f.from) q = q.gte(`${p}occurred_at`, fromLocalInput(`${f.from}T00:00`).toISOString());
  if (f.to) q = q.lt(`${p}occurred_at`, new Date(fromLocalInput(`${f.to}T00:00`).getTime() + 864e5).toISOString());
  if (f.type) q = q.eq(`${p}type`, f.type);
  if (f.wallet) q = q.or(`source_wallet_id.eq.${f.wallet},dest_wallet_id.eq.${f.wallet}`, p ? { referencedTable: "transactions" } : undefined);
  if (f.category) q = q.eq(`${p}category_id`, f.category);
  return q;
}

function TxPage() {
  const { view = "list" } = Route.useSearch();
  const nav = Route.useNavigate();
  const { user } = useAuth();
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();
  const [f, setF] = useState<Filters>({ q: "", from: "", to: "", type: "", wallet: "", category: "" });
  const [exporting, setExporting] = useState(false);

  const list = useInfiniteQuery({
    queryKey: ["txlist", f],
    enabled: !!user && view === "list",
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await applyFilters(supabase.from("transactions").select("*, transaction_photos(*)"), f)
        .order("occurred_at", { ascending: false }).range(pageParam, pageParam + PAGE - 1);
      if (error) throw error;
      return data as TxWithPhotos[];
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });

  const gallery = useInfiniteQuery({
    queryKey: ["gallery", f],
    enabled: !!user && view === "gallery",
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await applyFilters(supabase.from("transaction_photos").select("*, transactions!inner(*)"), f, "transactions.")
        .order("created_at", { ascending: false }).range(pageParam, pageParam + PAGE - 1);
      if (error) throw error;
      return data as (Photo & { transactions: Tx })[];
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });

  async function exportCsv() {
    setExporting(true);
    try {
      const rows: Tx[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await applyFilters(supabase.from("transactions").select("*"), f).order("occurred_at").range(from, from + 999);
        if (error) throw error;
        rows.push(...(data as Tx[]));
        if (data.length < 1000) break;
      }
      const wn = (id: string | null) => wallets.find((w) => w.id === id)?.name ?? "";
      const cn_ = (id: string | null) => {
        const c = categories.find((x) => x.id === id);
        if (!c) return ["", ""];
        const p = categories.find((x) => x.id === c.parent_id);
        return p ? [p.name, c.name] : [c.name, ""];
      };
      const TYPE: Record<string, string> = { expense: "Chi", income: "Thu", transfer: "Chuyển ví", journal: "Nhật ký" };
      const lines = [["Thời gian (Asia/Ho_Chi_Minh)", "Loại", "Số tiền (VND)", "Ví nguồn", "Ví nhận", "Danh mục", "Danh mục con", "Ghi chú"].join(",")];
      for (const t of rows) {
        const [c1, c2] = cn_(t.category_id);
        lines.push([
          csvCell(isoWithOffset(t.occurred_at)), csvCell(TYPE[t.type]), csvCell(String(t.amount_vnd)),
          csvCell(wn(t.source_wallet_id), true), csvCell(wn(t.dest_wallet_id), true), csvCell(c1, true), csvCell(c2, true), csvCell(t.note ?? "", true),
        ].join(","));
      }
      const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `capmoney-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast.success(`Đã xuất ${rows.length} giao dịch`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xuất CSV thất bại");
    } finally {
      setExporting(false);
    }
  }

  const { openNew } = useComposer();
  const q = view === "list" ? list : gallery;
  const items = (q.data?.pages ?? []).flat();

  return (
    <div>
      <PageHeader title={view === "gallery" ? "Ảnh" : "Giao dịch"} right={
        <div className="flex gap-2">
          <div className="flex rounded-full bg-surface p-1">
            <button aria-label="Danh sách" aria-pressed={view === "list"} onClick={() => nav({ search: { view: "list" } })} className={cn("grid size-10 place-items-center rounded-full", view === "list" && "bg-surface-2 text-primary")}><List className="size-5" /></button>
            <button aria-label="Thư viện ảnh" aria-pressed={view === "gallery"} onClick={() => nav({ search: { view: "gallery" } })} className={cn("grid size-10 place-items-center rounded-full", view === "gallery" && "bg-surface-2 text-primary")}><Images className="size-5" /></button>
          </div>
          <Button variant="secondary" className="h-12 rounded-full" onClick={exportCsv} disabled={exporting} aria-label="Xuất CSV">
            {exporting ? <Loader2 className="animate-spin" /> : <Download />} CSV
          </Button>
        </div>
      } />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Input className="col-span-2 sm:col-span-3" placeholder="Tìm trong ghi chú…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Tìm ghi chú" />
        <DatePicker clearable placeholder="Từ ngày" value={f.from} onChange={(v) => setF({ ...f, from: v })} aria-label="Từ ngày" />
        <DatePicker clearable placeholder="Đến ngày" value={f.to} onChange={(v) => setF({ ...f, to: v })} aria-label="Đến ngày" />
        <AppSelect aria-label="Loại" value={f.type} onChange={(v) => setF({ ...f, type: v })}
          options={[{ value: "", label: "Mọi loại" }, { value: "expense", label: "Chi" }, { value: "income", label: "Thu" }, { value: "transfer", label: "Chuyển ví" }, { value: "journal", label: "Nhật ký" }]} />
        <AppSelect aria-label="Ví" value={f.wallet} onChange={(v) => setF({ ...f, wallet: v })}
          options={[{ value: "", label: "Mọi ví" }, ...wallets.map((w) => ({ value: w.id, label: w.name }))]} />
        <AppSelect aria-label="Danh mục" className="col-span-2 sm:col-span-1" value={f.category} onChange={(v) => setF({ ...f, category: v })}
          options={[{ value: "", label: "Mọi danh mục" }, ...categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))]} />
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
      {q.isError && <p className="text-sm text-destructive">Không tải được. Kiểm tra kết nối.</p>}
      {!q.isLoading && !q.isError && items.length === 0 && (
        Object.values(f).some(Boolean)
          ? <Empty icon={<SearchX className="size-6" />} title="Không có kết quả" body="Không có giao dịch nào khớp bộ lọc. Thử đổi điều kiện tìm kiếm." action={<Button variant="secondary" className="h-11 rounded-full" onClick={() => setF(Object.fromEntries(Object.keys(f).map((k) => [k, ""])) as typeof f)}>Xoá bộ lọc</Button>} />
          : <Empty icon={<Camera className="size-6" />} title={view === "gallery" ? "Chưa có ảnh nào" : "Chưa có giao dịch"} body="Chụp một tấm ảnh để ghi khoản chi tiêu đầu tiên." action={<Button className="h-11 rounded-full" onClick={() => openNew()}><Camera /> Chụp & ghi</Button>} />
      )}

      {items.length === 0 ? null : view === "list" ? (
        <div className="flex flex-col rounded-3xl bg-surface p-2">
          {(items as TxWithPhotos[]).map((t) => <TxRow key={t.id} tx={t} categories={categories} wallets={wallets} />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {(items as (Photo & { transactions: Tx })[]).map((p) => (
            <Link key={p.id} to="/tx/$id" params={{ id: p.transaction_id }} className="relative aspect-square overflow-hidden rounded-2xl bg-surface">
              <PhotoThumb path={p.thumb_path} className="size-full" />
              <span className="absolute bottom-2 left-2 rounded-full bg-overlay px-2 py-0.5 text-xs font-semibold text-overlay-foreground">
                {p.transactions.type === "journal" ? "0đ · Nhật ký" : <Money value={Number(p.transactions.amount_vnd)} />}
              </span>
            </Link>
          ))}
        </div>
      )}
      {q.hasNextPage && (
        <Button variant="secondary" className="mt-4 h-11 w-full rounded-2xl" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? "Đang tải…" : "Tải thêm"}
        </Button>
      )}
    </div>
  );
}
