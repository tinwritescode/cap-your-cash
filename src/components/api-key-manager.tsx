import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm";
import { CodeBlock } from "@/components/code-block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Create / list / revoke the signed-in user's Agent API keys. Plain keys are shown once, kept in memory only. */
export function ApiKeyManager({ onCreated }: { onCreated?: (key: string) => void }) {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const ask = useConfirm();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keys = useQuery({
    queryKey: ["api_keys"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("api_keys").select("id,name,prefix,created_at,last_used_at,revoked_at").is("revoked_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loading) return null;
  if (!user)
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
        <p className="text-muted-foreground">Đăng nhập để tạo API key cho tài khoản của bạn.</p>
        <Button asChild size="sm"><Link to="/auth">Đăng nhập</Link></Button>
      </div>
    );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("create_api_key", { p_name: name.trim() || "AI Agent" });
    setBusy(false);
    if (error) return toast.error(error.message.replace(/^\w+:/, ""));
    const key = (data as { key: string }).key;
    setFresh(key);
    setName("");
    onCreated?.(key);
    qc.invalidateQueries({ queryKey: ["api_keys"] });
  }

  async function revoke(id: string, label: string) {
    if (!(await ask({ title: `Thu hồi key "${label}"?`, body: "Mọi agent đang dùng key này sẽ mất quyền truy cập ngay.", ok: "Thu hồi", destructive: true }))) return;
    const { error } = await supabase.rpc("revoke_api_key", { p_id: id });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["api_keys"] });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={create} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên key, vd: ChatGPT" maxLength={60} />
        <Button type="submit" disabled={busy}><KeyRound className="size-4" /> Tạo key</Button>
      </form>
      {fresh && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-primary">Sao chép ngay — key chỉ hiện một lần.</p>
          <CodeBlock code={fresh} label="API key" />
        </div>
      )}
      <ul className="divide-y rounded-2xl bg-surface-2">
        {(keys.data ?? []).map((k) => (
          <li key={k.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{k.name}</div>
              <div className="text-xs text-muted-foreground">{k.prefix}… · {k.last_used_at ? `dùng ${new Date(k.last_used_at).toLocaleString("vi-VN")}` : "chưa dùng"}</div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Thu hồi" onClick={() => revoke(k.id, k.name)}><Trash2 className="size-4" /></Button>
          </li>
        ))}
        {keys.data?.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Chưa có key nào.</li>}
      </ul>
    </div>
  );
}
