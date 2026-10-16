import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { challengeUsable, resolveRp } from "./passkey-rp";

const RP_NAME = "CapMoney";
const Uuid = z.string().uuid();
const Resp = z.record(z.string(), z.unknown());

function b64ToBytes(s: string) {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function bytesToB64(b: Uint8Array) {
  let s = "";
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s);
}

async function takeChallenge(id: string, purpose: "register" | "login", userId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: c } = await supabaseAdmin.from("passkey_challenges").select("*").eq("id", id).eq("purpose", purpose).maybeSingle();
  if (!c || !challengeUsable(c) || (userId && c.user_id !== userId)) throw new Error("Phiên passkey đã hết hạn. Hãy thử lại.");
  const { data: used } = await supabaseAdmin.from("passkey_challenges").update({ used_at: new Date().toISOString() }).eq("id", id).is("used_at", null).select("id");
  if (!used?.length) throw new Error("Phiên passkey đã hết hạn. Hãy thử lại.");
  return c.challenge;
}

/** Signed-in: begin adding a passkey to this account. */
export const startPasskeyRegister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateRegistrationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = resolveRp(getRequestHeader("origin"));
    const { data: existing } = await supabaseAdmin.from("passkeys").select("credential_id, transports").eq("user_id", context.userId);
    if ((existing?.length ?? 0) >= 10) throw new Error("Tối đa 10 passkey mỗi tài khoản.");
    const email = (context.claims as { email?: string }).email ?? "CapMoney";
    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID, userName: email, userID: new TextEncoder().encode(context.userId),
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((p) => ({ id: p.credential_id, transports: p.transports as never })),
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });
    const { data: row, error } = await supabaseAdmin.from("passkey_challenges").insert({ user_id: context.userId, challenge: options.challenge, purpose: "register" }).select("id").single();
    if (error) throw new Error("Không tạo được passkey");
    return { challengeId: row.id, options: JSON.stringify(options) };
  });

export const finishPasskeyRegister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ challengeId: Uuid, response: Resp, deviceName: z.string().max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID, origin } = resolveRp(getRequestHeader("origin"));
    const challenge = await takeChallenge(data.challengeId, "register", context.userId);
    const v = await verifyRegistrationResponse({ response: data.response as never, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false });
    if (!v.verified || !v.registrationInfo) throw new Error("Passkey không hợp lệ.");
    const cred = v.registrationInfo.credential;
    const { error } = await supabaseAdmin.from("passkeys").insert({
      user_id: context.userId, credential_id: cred.id, public_key: bytesToB64(cred.publicKey),
      counter: cred.counter, transports: cred.transports ?? [], device_name: data.deviceName || "Passkey",
    });
    if (error) throw new Error("Passkey này đã được thêm.");
    return { ok: true };
  });

/** Public: begin a passkey sign-in (discoverable credentials, no email needed). */
export const startPasskeyLogin = createServerFn({ method: "POST" }).handler(async () => {
  const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { rpID } = resolveRp(getRequestHeader("origin"));
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
  const { data: row, error } = await supabaseAdmin.from("passkey_challenges").insert({ challenge: options.challenge, purpose: "login" }).select("id").single();
  if (error) throw new Error("Không bắt đầu được đăng nhập passkey");
  return { challengeId: row.id, options: JSON.stringify(options) };
});

/** Public: verify the signed challenge and return a one-time sign-in token (same session path as Telegram login). */
export const finishPasskeyLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ challengeId: Uuid, response: Resp }).parse(d))
  .handler(async ({ data }) => {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID, origin } = resolveRp(getRequestHeader("origin"));
    const challenge = await takeChallenge(data.challengeId, "login");
    const credId = String((data.response as { id?: unknown }).id ?? "");
    const { data: pk } = await supabaseAdmin.from("passkeys").select("*").eq("credential_id", credId).maybeSingle();
    if (!pk) throw new Error("Passkey này chưa gắn với tài khoản CapMoney nào.");
    const v = await verifyAuthenticationResponse({
      response: data.response as never, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false,
      credential: { id: pk.credential_id, publicKey: b64ToBytes(pk.public_key), counter: Number(pk.counter), transports: pk.transports as never },
    });
    if (!v.verified) throw new Error("Xác thực passkey thất bại.");
    await supabaseAdmin.from("passkeys").update({ counter: v.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("id", pk.id);
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(pk.user_id);
    const email = u?.user?.email;
    if (!email) throw new Error("Tài khoản không có email nên chưa đăng nhập bằng passkey được.");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !link.properties?.hashed_token) throw new Error("Không tạo được phiên đăng nhập.");
    return { token_hash: link.properties.hashed_token };
  });
