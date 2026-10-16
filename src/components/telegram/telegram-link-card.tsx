import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/confirm";
import { useTelegramLink, type TelegramLink } from "@/lib/data";
import { startTelegramLink } from "@/lib/telegram.functions";

const PREFS: { key: keyof Pick<TelegramLink, "notify_budget" | "notify_daily" | "notify_weekly" | "notify_reminder">; label: string }[] = [
  { key: "notify_budget", label: "Cảnh báo ngân sách (80% và 100%)" },
  { key: "notify_daily", label: "Tổng kết mỗi tối (21h)" },
  { key: "notify_weekly", label: "Tổng kết tuần (Chủ nhật 21h)" },
  { key: "notify_reminder", label: "Nhắc ghi chép (20h nếu chưa ghi)" },
];

/** Profile card: link the account to the Telegram bot and choose bot notifications. */
export function TelegramLinkCard() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: link } = useTelegramLink(!!url);
  const linked = link ?? null;

  async function start() {
    setBusy(true);
    try { setUrl((await startTelegramLink()).url); }
    catch { toast.error("Không tạo được mã liên kết. Thử lại sau nhé."); }
    finally { setBusy(false); }
  }

  async function setPref(key: (typeof PREFS)[number]["key"], value: boolean) {
    if (!linked) return;
    const next = { ...linked, [key]: value };
    qc.setQueryData(["telegramLink"], next);
    const { error } = await supabase.rpc("telegram_set_prefs", { p_budget: next.notify_budget, p_daily: next.notify_daily, p_weekly: next.notify_weekly, p_reminder: next.notify_reminder });
    if (error) { toast.error("Không lưu được"); qc.invalidateQueries({ queryKey: ["telegramLink"] }); }
  }

  async function unlink() {
    if (!(await confirm({ title: "Huỷ liên kết Telegram?", body: "Bot sẽ ngừng gửi thông báo và không ghi chép được nữa.", ok: "Huỷ liên kết", destructive: true }))) return;
    const { error } = await supabase.rpc("telegram_unlink");
    if (error) return toast.error("Không huỷ được liên kết");
    qc.invalidateQueries({ queryKey: ["telegramLink"] });
  }

  return (
    <div className="rounded-3xl bg-surface p-4">
      <p className="flex items-center gap-2 font-semibold"><Send className="size-5" /> Telegram</p>
      {linked ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Đã liên kết{linked.username ? ` với @${linked.username}` : ""}. Nhắn bot để ghi chi tiêu, gửi ảnh hoá đơn hoặc hỏi số dư.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {PREFS.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3">
                <Label htmlFor={p.key} className="font-normal">{p.label}</Label>
                <Switch id={p.key} checked={linked[p.key]} onCheckedChange={(v) => setPref(p.key, v)} />
              </div>
            ))}
          </div>
          <Button variant="ghost" className="mt-3 text-destructive" onClick={unlink}>Huỷ liên kết</Button>
        </>
      ) : url ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Mở Telegram và bấm <b>Start</b>. Trang này tự cập nhật khi xong.</p>
          <Button asChild className="mt-3 w-full"><a href={url} target="_blank" rel="noopener noreferrer"><Send /> Mở Telegram</a></Button>
          <Button variant="ghost" className="mt-1 w-full" onClick={() => setUrl(null)}>Huỷ</Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Ghi chi tiêu bằng tin nhắn hoặc ảnh hoá đơn, nhận cảnh báo ngân sách và đăng nhập nhanh bằng Telegram.</p>
          <Button className="mt-3" disabled={busy} onClick={start}><Send /> Liên kết Telegram</Button>
        </>
      )}
    </div>
  );
}
