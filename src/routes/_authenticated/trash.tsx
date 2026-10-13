import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { invalidateFinance, rpcErrorMessage, useCategories, useWallets, type TxWithPhotos } from "@/lib/data";
import { formatDateTime } from "@/lib/finance";
import { Money } from "@/lib/ui-prefs";
import { PageHeader, Empty } from "@/components/shell";
import { PhotoThumb } from "@/components/photo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/trash")({
  head: () => ({
    meta: [
      { title: "Thùng rác — CapMoney" },
      { name: "description", content: "Khôi phục giao dịch đã xoá trong vòng 30 ngày." },
      { property: "og:title", content: "Thùng rác — CapMoney" },
      { property: "og:description", content: "Khôi phục giao dịch đã xoá." },
    ],
  }),
  component: Trash,
});

function Trash() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: cats = [] } = useCategories();
  const { data: wallets = [] } = useWallets();
  const q = useQuery({
    queryKey: ["trash"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*, transaction_photos(*)").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
      if (error) throw error;
      return data as TxWithPhotos[];
    },
  });

  async function restore(t: TxWithPhotos) {
    const { data, error } = await supabase.rpc("restore_transaction", { p_id: t.id, p_version: t.version });
    if (error) return toast.error(rpcErrorMessage(error));
    const r = data as { status: string; message?: string };
    if (r.status === "conflict") { toast.error(r.message ?? "Xung đột"); q.refetch(); return; }
    invalidateFinance(qc);
    toast.success("Đã khôi phục");
  }

  return (
    <div>
      <PageHeader title="Thùng rác" />
      <p className="mb-4 text-sm text-muted-foreground">Giao dịch được giữ 30 ngày kể từ lúc xoá, sau đó bị xoá vĩnh viễn cùng ảnh.</p>
      {q.data?.length === 0 && <Empty title="Thùng rác trống" body="Giao dịch bạn xoá sẽ xuất hiện ở đây." />}
      <div className="flex flex-col gap-2">
        {(q.data ?? []).map((t) => {
          const deadline = new Date(new Date(t.deleted_at!).getTime() + 30 * 864e5);
          const cat = cats.find((c) => c.id === t.category_id);
          const p = t.transaction_photos[0];
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-3xl bg-surface p-3">
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 text-xl">
                {p ? <PhotoThumb path={p.thumb_path} className="size-full" /> : cat?.icon ?? "⇄"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{cat?.name ?? (t.type === "transfer" ? `${wallets.find((w) => w.id === t.source_wallet_id)?.name} → ${wallets.find((w) => w.id === t.dest_wallet_id)?.name}` : "Nhật ký ảnh")}</p>
                <p className="text-xs text-muted-foreground">Khôi phục trước {formatDateTime(deadline)}</p>
              </div>
              {t.type === "journal" ? <span className="text-sm">0đ</span> : <Money value={Number(t.amount_vnd)} className="font-semibold" />}
              <Button variant="secondary" className="h-11" onClick={() => restore(t)}>Khôi phục</Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
