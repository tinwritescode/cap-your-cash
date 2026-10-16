import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { pollTelegramLogin, startTelegramLogin } from "@/lib/telegram.functions";

/** "Login with Telegram": opens the bot with a one-time code, then waits for the user to confirm there. */
export function TelegramLogin() {
  const [attempt, setAttempt] = useState<{ url: string; code: string; poll: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!attempt) return;
    const started = Date.now();
    timer.current = setInterval(async () => {
      if (Date.now() - started > 10 * 60_000) return stop("Mã đã hết hạn. Hãy thử lại.");
      try {
        const r = await pollTelegramLogin({ data: { code: attempt.code, poll: attempt.poll } });
        if (r.status === "pending") return;
        if (r.status === "approved") {
          stop();
          const { error } = await supabase.auth.verifyOtp({ token_hash: r.token_hash, type: "magiclink" });
          if (error) toast.error("Đăng nhập thất bại. Hãy thử lại.");
        } else stop(r.status === "denied" ? "Đăng nhập bị từ chối hoặc Telegram chưa liên kết." : "Mã đã hết hạn. Hãy thử lại.");
      } catch { /* network blip, keep polling */ }
    }, 2000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [attempt]);

  function stop(msg?: string) {
    if (timer.current) clearInterval(timer.current);
    setAttempt(null);
    if (msg) toast.error(msg);
  }

  async function start() {
    setBusy(true);
    try { setAttempt(await startTelegramLogin()); }
    catch { toast.error("Không kết nối được Telegram. Thử lại sau nhé."); }
    finally { setBusy(false); }
  }

  if (!attempt) {
    return (
      <Button variant="secondary" className="mt-3 h-12 w-full rounded-2xl" disabled={busy} onClick={start}>
        <Send /> Đăng nhập bằng Telegram
      </Button>
    );
  }
  return (
    <div className="mt-3 rounded-2xl bg-muted p-3 text-sm">
      <p>Mở Telegram và bấm <b>Start</b>, rồi <b>Đăng nhập</b> trong bot. Trang này sẽ tự đăng nhập.</p>
      <Button asChild className="mt-3 h-11 w-full">
        <a href={attempt.url} target="_blank" rel="noopener noreferrer"><Send /> Mở Telegram</a>
      </Button>
      <Button variant="ghost" className="mt-1 w-full" onClick={() => stop()}>Huỷ</Button>
    </div>
  );
}
