import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/shell";
import { ComposerProvider } from "@/components/composer";
import { Tutorial } from "@/components/tutorial";
import { PrefsProvider } from "@/lib/ui-prefs";
import { useAuth } from "@/lib/auth";
import { useProfile, useRealtimeInvalidation, useWallets } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";
import { tutorialBus } from "@/lib/tutorial-bus";

export const Route = createFileRoute("/_authenticated")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});


function Layout() {
  const { user, loading } = useAuth();
  useRealtimeInvalidation();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: wallets } = useWallets();
  const [manual, setManual] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  useEffect(() => {
    tutorialBus.open = () => setManual(true);
    const refocus = () => qc.invalidateQueries();
    window.addEventListener("focus", refocus);
    return () => window.removeEventListener("focus", refocus);
  }, [qc]);

  if (loading || !user) return <div className="min-h-dvh" />;

  const auto = !sessionDone && profile?.tutorial_status === "unseen" && wallets !== undefined && wallets.length === 0;

  async function finish(result: "completed" | "dismissed") {
    if (manual) { setManual(false); return; }
    setSessionDone(true);
    const { error } = await supabase.from("profiles").update({ tutorial_status: result }).eq("id", user!.id);
    if (error) {
      toast.error("Chưa lưu được trạng thái hướng dẫn.", { action: { label: "Thử lại", onClick: () => finish(result) } });
    } else qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <PrefsProvider>
      <ComposerProvider>
        <AppShell>
          <Outlet />
        </AppShell>
        <Tutorial open={auto || manual} onFinish={finish} />
      </ComposerProvider>
    </PrefsProvider>
  );
}
