import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteMonthlyBudget, invalidateFinance, upsertMonthlyBudget } from "@/lib/data";
import { computeBudget, monthIso, parseVnd } from "@/lib/finance";
import { Money } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

export function BudgetCard({
  y,
  m,
  spent,
  budget,
}: {
  y: number;
  m: number;
  spent: number;
  budget: number | null;
}) {
  const [open, setOpen] = useState(false);
  const b = computeBudget(budget, spent, y, m);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-4 rounded-3xl bg-surface p-4 text-left"
      >
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <PiggyBank />
        </div>
        {b.kind === "none" ? (
          <div className="flex-1">
            <p className="font-semibold">Ngân sách tháng · Tất cả ví</p>
            <p className="text-sm text-primary">Đặt ngân sách</p>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Ngân sách · Tất cả ví</p>
              <div
                className="my-2 h-2 rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={b.percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn("h-2 rounded-full", b.exceeded ? "bg-expense" : "bg-primary")}
                  style={{ width: `${Math.min(100, b.percent)}%` }}
                />
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {b.percent}% đã dùng
                {b.daily !== null ? (
                  <>
                    {" "}
                    · Mỗi ngày: <Money value={b.daily} /> · {b.daysLeft} ngày
                  </>
                ) : null}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Còn lại</p>
              <Money
                value={b.remaining}
                className={cn(
                  "text-lg font-bold",
                  b.remaining < 0 ? "text-expense" : "text-income",
                )}
              />
            </div>
          </>
        )}
      </button>
      {b.kind === "set" && b.exceeded && (
        <p
          role="alert"
          className="mt-2 flex items-center gap-2 rounded-2xl bg-destructive/15 px-4 py-2 text-sm text-destructive"
        >
          <AlertTriangle className="size-4" />{" "}
          {b.zeroBudget
            ? "Ngân sách 0đ — mọi khoản chi đều vượt."
            : "Bạn đã chi vượt ngân sách tháng này."}
        </p>
      )}
      <BudgetDialog open={open} onOpenChange={setOpen} y={y} m={m} current={budget} />
    </>
  );
}

function BudgetDialog({
  open,
  onOpenChange,
  y,
  m,
  current,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  y: number;
  m: number;
  current: number | null;
}) {
  const qc = useQueryClient();
  const [v, setV] = useState(current !== null ? String(current) : "");
  async function save() {
    const amt = parseVnd(v);
    if (amt === null) return toast.error("Số tiền không hợp lệ");
    const { error } = await upsertMonthlyBudget(monthIso(y, m), amt);
    if (error) return toast.error(error.message);
    invalidateFinance(qc);
    onOpenChange(false);
  }
  async function remove() {
    await deleteMonthlyBudget(monthIso(y, m));
    invalidateFinance(qc);
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl bg-surface sm:max-w-sm">
        <DialogTitle>
          Ngân sách tháng {m}/{y}
        </DialogTitle>
        <DialogDescription>Áp dụng cho chi tiêu của tất cả ví.</DialogDescription>
        <Input
          inputMode="numeric"
          className="h-12 text-xl"
          value={v ? (parseVnd(v) ?? 0).toLocaleString("en-US") : ""}
          onChange={(e) => setV(e.target.value)}
          placeholder="0"
        />
        <div className="flex gap-2">
          {current !== null && (
            <Button variant="ghost" onClick={remove}>
              Xoá
            </Button>
          )}
          <div className="flex-1" />
          <Button onClick={save}>Lưu</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
