import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { name: "robots", content: "noindex" },
      { title: "Đặt lại mật khẩu — CapMoney" },
      { name: "description", content: "Đặt mật khẩu mới cho tài khoản CapMoney." },
      { property: "og:title", content: "Đặt lại mật khẩu — CapMoney" },
      { property: "og:description", content: "Đặt mật khẩu mới cho tài khoản CapMoney." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (pw.length < 8) return setErr("Mật khẩu tối thiểu 8 ký tự.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setErr(error.message);
    toast.success("Đã đổi mật khẩu");
    nav({ to: "/" });
  }
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="text-2xl font-bold">Đặt mật khẩu mới</h1>
        <Label htmlFor="np">Mật khẩu mới</Label>
        <Input
          id="np"
          type="password"
          className="h-11"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="new-password"
        />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="h-12 rounded-2xl" onClick={save}>
          Lưu mật khẩu
        </Button>
      </div>
    </div>
  );
}
