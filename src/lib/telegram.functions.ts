import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Hex = z.string().regex(/^[a-f0-9]{32}$/);

/** Public: start a "Login with Telegram" attempt. Returns the bot deep link and a private poll token. */
export const startTelegramLogin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getBotUsername, hashCode, randomCode } = await import("./telegram/api.server");
  const code = randomCode();
  const poll = randomCode();
  const { error } = await supabaseAdmin.from("telegram_codes").insert({ code_hash: await hashCode(code), poll_hash: await hashCode(poll), purpose: "login" });
  if (error) throw new Error("Không tạo được mã đăng nhập");
  return { url: `https://t.me/${await getBotUsername()}?start=login_${code}`, code, poll };
});

/** Public: check a login attempt. Only the holder of the poll token receives the one-time sign-in token. */
export const pollTelegramLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: Hex, poll: Hex }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashCode } = await import("./telegram/api.server");
    const codeHash = await hashCode(data.code);
    const { data: row } = await supabaseAdmin.from("telegram_codes").select("*").eq("code_hash", codeHash).eq("purpose", "login").maybeSingle();
    if (!row || row.poll_hash !== (await hashCode(data.poll))) return { status: "expired" as const };
    if (row.status === "denied") return { status: "denied" as const };
    if (row.status !== "approved" || !row.approved_user_id) {
      return { status: new Date(row.expires_at) < new Date() || row.status === "used" ? ("expired" as const) : ("pending" as const) };
    }
    // Consume exactly once.
    const { data: used } = await supabaseAdmin.from("telegram_codes").update({ status: "used" }).eq("code_hash", codeHash).eq("status", "approved").select("code_hash");
    if (!used?.length) return { status: "expired" as const };
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.approved_user_id);
    const email = u?.user?.email;
    if (!email) return { status: "denied" as const };
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !link.properties?.hashed_token) return { status: "expired" as const };
    return { status: "approved" as const, token_hash: link.properties.hashed_token };
  });

/** Signed-in: create a one-time link code for connecting this account to Telegram. */
export const startTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getBotUsername, hashCode, randomCode } = await import("./telegram/api.server");
    const code = randomCode();
    const { error } = await supabaseAdmin.from("telegram_codes").insert({ code_hash: await hashCode(code), purpose: "link", user_id: context.userId });
    if (error) throw new Error("Không tạo được mã liên kết");
    return { url: `https://t.me/${await getBotUsername()}?start=link_${code}` };
  });
