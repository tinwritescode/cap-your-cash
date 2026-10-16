import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm";
import { finishPasskeyRegister, startPasskeyRegister } from "@/lib/passkey.functions";
import { passkeyError } from "./passkey-error";

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Passkey";
}

const fmt = (s: string) => new Date(s).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

/** Profile card: add, list and remove passkeys for this account. */
export function PasskeyManager() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const { data: keys } = useQuery({
    queryKey: ["passkeys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("passkeys").select("id, device_name, created_at, last_used_at").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  async function add() {
    if (!browserSupportsWebAuthn()) return toast.error("Trình duyệt này chưa hỗ trợ passkey.");
    setBusy(true);
    try {
      const { challengeId, options } = await startPasskeyRegister();
      const response = await startRegistration({ optionsJSON: JSON.parse(options) });
      await finishPasskeyRegister({ data: { challengeId, response: response as never, deviceName: deviceName() } });
      toast.success("Đã thêm passkey.");
      qc.invalidateQueries({ queryKey: ["passkeys"] });
    } catch (e) {
      const m = passkeyError(e);
      if (m) toast.error(m);
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Xoá passkey?", body: "Thiết bị này sẽ không đăng nhập bằng passkey được nữa.", ok: "Xoá", destructive: true }))) return;
    const { error } = await supabase.rpc("passkey_delete", { p_id: id });
    if (error) toast.error("Chưa xoá được passkey.");
    else qc.invalidateQueries({ queryKey: ["passkeys"] });
  }

  return (
    <div className="rounded-3xl bg-surface p-4">
      <p className="flex items-center gap-2 font-semibold"><Fingerprint className="size-5" /> Passkey</p>
      <p className="mt-1 text-sm text-muted-foreground">Đăng nhập bằng Face ID, vân tay hoặc mã máy, không cần mật khẩu.</p>
      {!!keys?.length && (
        <ul className="mt-3 divide-y divide-border">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium">{k.device_name}</p>
                <p className="text-xs text-muted-foreground">Thêm {fmt(k.created_at)}{k.last_used_at ? ` · Dùng ${fmt(k.last_used_at)}` : ""}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Xoá passkey" onClick={() => remove(k.id)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-3" disabled={busy || (keys?.length ?? 0) >= 10} onClick={add}>Thêm passkey</Button>
    </div>
  );
}
