import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { finishPasskeyLogin, startPasskeyLogin } from "@/lib/passkey.functions";
import { passkeyError } from "./passkey-error";

/** "Sign in with passkey" button for the sign-in screen. */
export function PasskeyLogin() {
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!browserSupportsWebAuthn()) return toast.error("Trình duyệt này chưa hỗ trợ passkey.");
    setBusy(true);
    try {
      const { challengeId, options } = await startPasskeyLogin();
      const response = await startAuthentication({ optionsJSON: JSON.parse(options) });
      const { token_hash } = await finishPasskeyLogin({ data: { challengeId, response: response as never } });
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
      if (error) throw error;
    } catch (e) {
      const m = passkeyError(e);
      if (m) toast.error(m);
    } finally { setBusy(false); }
  }

  return (
    <Button variant="secondary" className="mt-3 h-12 w-full rounded-2xl" disabled={busy} onClick={go}>
      <Fingerprint /> Đăng nhập bằng passkey
    </Button>
  );
}
