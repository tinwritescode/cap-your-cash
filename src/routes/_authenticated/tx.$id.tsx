import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invalidateFinance, rpcErrorMessage, useCategories, useSignedUrls, useTx, useWallets } from "@/lib/data";
import { formatDateTime } from "@/lib/finance";
import { Money } from "@/lib/ui-prefs";
import { useComposer } from "@/components/composer";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/tx/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Chi tiết giao dịch — CapMoney" },
      { name: "description", content: "Ảnh, số tiền, ví, danh mục và ghi chú của giao dịch." },
      { property: "og:title", content: "Chi tiết giao dịch — CapMoney" },
      { property: "og:description", content: "Chi tiết giao dịch." },
    ],
  }),
  component: Detail,
});

const TYPE: Record<string, string> = { expense: "Khoản chi", income: "Khoản thu", transfer: "Chuyển ví", journal: "Nhật ký ảnh" };

function Detail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: tx, isLoading, refetch } = useTx(id);
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();
  const { openEdit } = useComposer();
  const photos = (tx?.transaction_photos ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const { data: urls } = useSignedUrls(photos.map((p) => p.original_path));
  const [idx, setIdx] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <p className="py-10 text-center text-muted-foreground">Đang tải…</p>;
  if (!tx) return <p className="py-10 text-center text-muted-foreground">Không tìm thấy giao dịch.</p>;

  const cat = categories.find((c) => c.id === tx.category_id);
  const parent = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : null;
  const wn = (wid: string | null) => wallets.find((w) => w.id === wid)?.name;
  const deleted = !!tx.deleted_at;

  async function trash() {
    setBusy(true);
    const { data, error } = await supabase.rpc("trash_transaction", { p_id: tx!.id, p_version: tx!.version });
    setBusy(false);
    setConfirm(false);
    if (error) return toast.error(rpcErrorMessage(error));
    const r = data as { status: string; message?: string };
    if (r.status === "conflict") { toast.error(r.message ?? "Xung đột"); refetch(); return; }
    invalidateFinance(qc);
    toast.success("Đã chuyển vào thùng rác (khôi phục được trong 30 ngày)");
    router.history.back();
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <button aria-label="Đóng" onClick={() => router.history.back()} className="grid size-12 place-items-center rounded-full bg-surface"><X /></button>
        <p className="rounded-full bg-surface px-4 py-2 text-sm text-muted-foreground">{formatDateTime(tx.occurred_at)}</p>
        <div className="size-12" />
      </div>

      {photos.length > 0 && (
        <div className="relative overflow-hidden rounded-[2rem] bg-surface">
          {urls?.[photos[idx].original_path] ? (
            <img src={urls[photos[idx].original_path]} alt={`Ảnh ${idx + 1}`} className="max-h-[60dvh] w-full object-contain" />
          ) : <div className="aspect-square animate-pulse bg-muted" />}
          {photos.length > 1 && (
            <>
              <button aria-label="Ảnh trước" disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-overlay text-overlay-foreground disabled:opacity-30"><ChevronLeft /></button>
              <button aria-label="Ảnh sau" disabled={idx === photos.length - 1} onClick={() => setIdx(idx + 1)} className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-overlay text-overlay-foreground disabled:opacity-30"><ChevronRight /></button>
              <span className="absolute bottom-3 right-3 rounded-full bg-overlay px-3 py-1 text-xs text-overlay-foreground">{idx + 1}/{photos.length}</span>
            </>
          )}
        </div>
      )}

      <div className="rounded-3xl bg-surface p-5 text-center">
        <p className="text-sm text-muted-foreground">{TYPE[tx.type]}</p>
        {tx.type === "journal" ? <p className="text-4xl font-bold">0đ</p> : (
          <Money value={Number(tx.amount_vnd)} sign={tx.type === "expense" ? "-" : tx.type === "income" ? "+" : undefined}
            className={`block text-4xl font-bold ${tx.type === "expense" ? "text-expense" : tx.type === "income" ? "text-income" : ""}`} />
        )}
        {tx.note && <p className="mt-2">{tx.note}</p>}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-3xl bg-surface p-5 text-sm">
        {tx.source_wallet_id && <><dt className="text-muted-foreground">{tx.type === "transfer" ? "Từ ví" : "Ví"}</dt><dd>{wn(tx.source_wallet_id)}</dd></>}
        {tx.dest_wallet_id && <><dt className="text-muted-foreground">{tx.type === "transfer" ? "Đến ví" : "Ví nhận"}</dt><dd>{wn(tx.dest_wallet_id)}</dd></>}
        {cat && <><dt className="text-muted-foreground">Danh mục</dt><dd>{cat.icon} {parent ? `${parent.name} › ` : ""}{cat.name}</dd></>}
        <dt className="text-muted-foreground">Thời gian</dt><dd>{formatDateTime(tx.occurred_at)} (GMT+7)</dd>
      </dl>

      {deleted ? (
        <p className="text-center text-sm text-muted-foreground">Giao dịch này đang ở Thùng rác.</p>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" className="h-12 flex-1 rounded-2xl" onClick={() => openEdit(tx)}><Pencil /> Sửa</Button>
          <Button variant="destructive" className="h-12 flex-1 rounded-2xl" onClick={() => setConfirm(true)} disabled={busy}><Trash2 /> Xoá</Button>
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-3xl bg-surface">
          <AlertDialogTitle>Chuyển vào thùng rác?</AlertDialogTitle>
          <AlertDialogDescription>Số dư và báo cáo sẽ cập nhật ngay. Bạn có thể khôi phục trong 30 ngày.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={trash}>Chuyển vào thùng rác</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
