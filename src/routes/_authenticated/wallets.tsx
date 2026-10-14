import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Archive, ArchiveRestore, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  invalidateFinance,
  archiveCategory,
  archiveWallet,
  createCategory,
  renameWallet,
  useBalances,
  useCategories,
  useWallets,
  type Category,
} from "@/lib/data";
import { formatDateTime } from "@/lib/finance";
import { Money } from "@/lib/ui-prefs";
import { PageHeader } from "@/components/shell";
import { WalletForm, KIND_LABEL } from "@/components/wallet-form";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/pickers";

export const Route = createFileRoute("/_authenticated/wallets")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Ví & danh mục — CapMoney" },
      {
        name: "description",
        content: "Quản lý ví tiền mặt, ngân hàng, thẻ tín dụng và danh mục thu chi.",
      },
      { property: "og:title", content: "Ví & danh mục — CapMoney" },
      { property: "og:description", content: "Quản lý ví và danh mục." },
    ],
  }),
  component: WalletsPage,
});

function WalletsPage() {
  const qc = useQueryClient();
  const { data: wallets = [] } = useWallets();
  const { data: balances = {} } = useBalances();
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const total = wallets
    .filter((w) => !w.archived_at)
    .reduce((s, w) => s + (balances[w.id] ?? 0), 0);

  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [savingName, setSavingName] = useState(false);
  function rename(id: string, current: string) {
    setRenaming({ id, name: current });
  }
  async function saveRename(e: React.FormEvent) {
    e.preventDefault();
    const name = renaming?.name.trim();
    if (!renaming || !name) return;
    setSavingName(true);
    const { error } = await renameWallet(renaming.id, name);
    setSavingName(false);
    if (error) return toast.error(error.message);
    invalidateFinance(qc);
    toast.success("Đã đổi tên ví");
    setRenaming(null);
  }
  async function archive(id: string, on: boolean) {
    const { error } = await archiveWallet(id, on);
    if (error) toast.error(error.message);
    else invalidateFinance(qc);
  }

  const visible = wallets.filter((w) => showArchived || !w.archived_at);
  return (
    <div>
      <PageHeader
        title="Ví"
        right={
          <Button className="h-11 rounded-full" onClick={() => setAdding(true)}>
            <Plus /> Thêm ví
          </Button>
        }
      />
      <div className="mb-4 rounded-3xl bg-surface p-5">
        <p className="text-sm text-muted-foreground">Tổng số dư (ví đang dùng)</p>
        <Money value={total} className="text-3xl font-bold" />
      </div>
      <div className="flex flex-col gap-2">
        {visible.map((w) => (
          <div key={w.id} className="flex items-center gap-3 rounded-3xl bg-surface p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {w.name}{" "}
                {w.archived_at && (
                  <span className="text-xs text-muted-foreground">(đã lưu trữ)</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {KIND_LABEL[w.kind]} · từ {formatDateTime(w.opening_at)}
              </p>
            </div>
            <Money
              value={balances[w.id] ?? 0}
              className={`font-bold ${(balances[w.id] ?? 0) < 0 ? "text-expense" : ""}`}
            />
            <Button
              aria-label="Đổi tên"
              onClick={() => rename(w.id, w.name)}
              className="grid size-11 place-items-center rounded-full hover:bg-surface-2"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              aria-label={w.archived_at ? "Bỏ lưu trữ" : "Lưu trữ"}
              onClick={() => archive(w.id, !w.archived_at)}
              className="grid size-11 place-items-center rounded-full hover:bg-surface-2"
            >
              {w.archived_at ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
            </Button>
          </div>
        ))}
      </div>
      <Button className="mt-3 text-sm text-primary" onClick={() => setShowArchived(!showArchived)}>
        {showArchived ? "Ẩn ví đã lưu trữ" : "Hiện ví đã lưu trữ"}
      </Button>

      <Categories />

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="rounded-3xl bg-surface sm:max-w-md">
          <DialogTitle>Ví mới</DialogTitle>
          <WalletForm onDone={() => setAdding(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="rounded-3xl bg-surface sm:max-w-sm">
          <DialogTitle>Đổi tên ví</DialogTitle>
          <form onSubmit={saveRename} className="flex flex-col gap-4">
            <Input
              autoFocus
              maxLength={40}
              className="h-12 text-base"
              value={renaming?.name ?? ""}
              onChange={(e) => setRenaming((r) => r && { ...r, name: e.target.value })}
              aria-label="Tên ví"
              placeholder="Ví dụ: Tiền mặt"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-12 flex-1 rounded-2xl"
                onClick={() => setRenaming(null)}
              >
                Huỷ
              </Button>
              <Button
                type="submit"
                className="h-12 flex-1 rounded-2xl"
                disabled={savingName || !renaming?.name.trim()}
              >
                Lưu
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Categories() {
  const qc = useQueryClient();
  const { data: cats = [] } = useCategories();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📦");
  const [parent, setParent] = useState("");
  const list = cats.filter((c) => c.type === type);
  const roots = list.filter((c) => !c.parent_id);

  async function add() {
    if (!name.trim()) return;
    const { error } = await createCategory({
      p_name: name.trim(),
      p_icon: icon || "📦",
      p_type: type,
      p_parent_id: parent || null,
    });
    if (error) return toast.error(error.message);
    setName("");
    setParent("");
    invalidateFinance(qc);
  }
  async function toggle(c: Category) {
    const { error } = await archiveCategory(c.id, !c.archived_at);
    if (error) toast.error(error.message);
    else invalidateFinance(qc);
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-bold">Danh mục</h2>
      <div className="mb-3 flex rounded-full bg-surface p-1">
        {(["expense", "income"] as const).map((t) => (
          <Button
            key={t}
            onClick={() => setType(t)}
            aria-pressed={type === t}
            className={`min-h-11 flex-1 rounded-full text-sm ${type === t ? "bg-surface-2 font-semibold" : "text-muted-foreground"}`}
          >
            {t === "expense" ? "Chi" : "Thu"}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-1 rounded-3xl bg-surface p-2">
        {roots.map((r) => (
          <div key={r.id}>
            <CatRow c={r} onToggle={toggle} />
            {list
              .filter((c) => c.parent_id === r.id)
              .map((c) => (
                <div key={c.id} className="pl-8">
                  <CatRow c={c} onToggle={toggle} />
                </div>
              ))}
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[4rem_1fr] gap-2 rounded-3xl bg-surface p-3">
        <Input
          className="text-center"
          value={icon}
          maxLength={4}
          onChange={(e) => setIcon(e.target.value)}
          aria-label="Biểu tượng"
        />
        <Input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên danh mục mới"
        />
        <AppSelect
          className="col-span-2"
          aria-label="Danh mục cha"
          value={parent}
          onChange={setParent}
          options={[
            { value: "", label: "Danh mục chính" },
            ...roots
              .filter((r) => !r.archived_at)
              .map((r) => ({ value: r.id, label: `Con của: ${r.icon} ${r.name}` })),
          ]}
        />
        <Button className="col-span-2 h-11" onClick={add}>
          Thêm danh mục
        </Button>
      </div>
    </section>
  );
}

function CatRow({ c, onToggle }: { c: Category; onToggle: (c: Category) => void }) {
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-2xl px-3">
      <span className="text-xl">{c.icon}</span>
      <span className={`flex-1 ${c.archived_at ? "text-muted-foreground line-through" : ""}`}>
        {c.name}
      </span>
      <Button className="text-xs text-primary" onClick={() => onToggle(c)}>
        {c.archived_at ? "Dùng lại" : "Lưu trữ"}
      </Button>
    </div>
  );
}
