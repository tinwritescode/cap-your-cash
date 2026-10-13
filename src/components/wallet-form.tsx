import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invalidateFinance } from "@/lib/data";
import { fromLocalInput, parseVnd, toLocalInput } from "@/lib/finance";

export const KIND_LABEL: Record<string, string> = { cash: "💵 Tiền mặt", bank: "🏦 Ngân hàng", credit: "💳 Thẻ tín dụng" };

export function WalletForm({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("cash");
  const [opening, setOpening] = useState("");
  const [negative, setNegative] = useState(false);
  const [at, setAt] = useState(toLocalInput(new Date()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (!name.trim()) return setErr("Nhập tên ví.");
    const amt = opening ? parseVnd(opening) : 0;
    if (amt === null) return setErr("Số dư không hợp lệ.");
    setBusy(true);
    const { error } = await supabase.from("wallets").insert({
      name: name.trim(), kind, opening_balance_vnd: negative ? -amt : amt, opening_at: fromLocalInput(at).toISOString(),
    } as never);
    setBusy(false);
    if (error) return setErr(error.message);
    toast.success("Đã tạo ví");
    invalidateFinance(qc);
    onDone?.();
  }

  return (
    <div className="flex flex-col gap-3">
      <div><Label htmlFor="wn">Tên ví</Label><Input id="wn" className="mt-1 h-11" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Tiền mặt" /></div>
      <div>
        <Label>Loại</Label>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {Object.entries(KIND_LABEL).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
              className={`min-h-11 rounded-xl text-xs ${kind === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="ob">Số dư ban đầu (VND)</Label>
        <div className="mt-1 flex gap-2">
          <Button type="button" variant="secondary" className="h-11 w-11" onClick={() => setNegative(!negative)} aria-label="Đổi dấu">{negative ? "−" : "+"}</Button>
          <Input id="ob" inputMode="numeric" className="h-11" value={opening ? (parseVnd(opening) ?? 0).toLocaleString("en-US") : ""} onChange={(e) => setOpening(e.target.value)} placeholder="0" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Chỉ nhập lúc tạo. Sau này hãy dùng giao dịch để thay đổi.</p>
      </div>
      <div><Label htmlFor="oa">Bắt đầu theo dõi từ</Label><Input id="oa" type="datetime-local" className="mt-1 h-11" value={at} onChange={(e) => setAt(e.target.value)} /></div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button className="h-12 rounded-2xl" disabled={busy} onClick={save}>Tạo ví</Button>
    </div>
  );
}
