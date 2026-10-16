import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { NoelDecor, FestiveLogo } from "@/components/noel-decor";
import { applyAccent } from "@/lib/themes";
import { TelegramLogin } from "@/components/telegram/telegram-login";
import { PasskeyLogin } from "@/components/passkey/passkey-login";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Đăng nhập — CapMoney" },
      { name: "description", content: "Đăng nhập hoặc tạo tài khoản CapMoney để quản lý chi tiêu bằng ảnh." },
      { property: "og:title", content: "Đăng nhập — CapMoney" },
      { property: "og:description", content: "Quản lý chi tiêu cá nhân bằng ảnh." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (user) nav({ to: "/" }); }, [user, nav]);
  // Signed-out visitors always see the Christmas look; signed-in users get their saved accent.
  useEffect(() => { if (!user) applyAccent("noel", document.documentElement.classList.contains("light")); }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else if (mode === "up") {
        if (pw.length < 8) throw new Error("Mật khẩu tối thiểu 8 ký tự.");
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setMsg("Đã gửi email xác nhận. Hãy mở email và bấm vào liên kết để kích hoạt tài khoản.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMsg("Nếu email tồn tại, bạn sẽ nhận được liên kết đặt lại mật khẩu.");
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      setMsg(/Invalid login/i.test(m) ? "Email hoặc mật khẩu không đúng." : /not confirmed/i.test(m) ? "Email chưa được xác nhận." : m);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Đăng nhập Google thất bại. Hãy thử lại.");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <NoelDecor />
        <FestiveLogo />
        <h1 className="text-3xl font-bold">CapMoney</h1>
        <p className="mb-6 mt-1 text-muted-foreground">Chụp lại, biết tiền đi đâu.</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div><Label htmlFor="em">Email</Label><Input id="em" type="email" required autoComplete="email" className="mt-1 h-11" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {mode !== "forgot" && (
            <div><Label htmlFor="pw">Mật khẩu</Label><Input id="pw" type="password" required autoComplete={mode === "up" ? "new-password" : "current-password"} className="mt-1 h-11" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          )}
          {msg && <p role="status" className="rounded-xl bg-muted p-3 text-sm">{msg}</p>}
          <Button type="submit" disabled={busy} className="h-12 rounded-2xl">
            {mode === "in" ? "Đăng nhập" : mode === "up" ? "Tạo tài khoản" : "Gửi liên kết đặt lại"}
          </Button>
        </form>
        {mode !== "forgot" && (
          <Button variant="secondary" className="mt-3 h-12 w-full rounded-2xl" onClick={google}>Tiếp tục với Google</Button>
        )}
        {mode === "in" && <PasskeyLogin />}
        {mode === "in" && <TelegramLogin />}
        <div className="mt-5 flex flex-col items-center gap-2 text-sm">
          {mode === "in" && <button className="text-primary" onClick={() => setMode("forgot")}>Quên mật khẩu?</button>}
          <button className="text-muted-foreground" onClick={() => { setMode(mode === "up" ? "in" : "up"); setMsg(null); }}>
            {mode === "up" ? "Đã có tài khoản? Đăng nhập" : mode === "forgot" ? "Quay lại đăng nhập" : "Chưa có tài khoản? Đăng ký"}
          </button>
        </div>
      </div>
    </div>
  );
}
