import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  audio: z.string().min(100).max(8_000_000), // base64, ~6MB
  mime: z.string().regex(/^audio\/[a-z0-9.+-]+(;.*)?$/i),
});

export type VoiceResult =
  | { ok: true; text: string; type: "expense" | "income" | null; amount: number | null; categoryId: string | null; walletId: string | null; note: string | null; occurredAt: string | null }
  | { ok: false; error: string };

async function transcribe(audio: Uint8Array, mime: string, apiKey: string): Promise<string> {
  const ext = mime.includes("mp4") || mime.includes("m4a") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
  const fd = new FormData();
  fd.append("file", new Blob([audio], { type: mime.split(";")[0] }), `voice.${ext}`);
  fd.append("model", "openai/gpt-transcribe");
  fd.append("stream", "true");
  fd.append("languages", "vi");
  fd.append("prompt", "Người Việt đọc một khoản thu chi, có thể dùng tiếng lóng như củ, xị, chai, chục, k, rưỡi.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: fd,
  });
  if (!res.ok || !res.body) {
    console.error(`transcribe failed [${res.status}]: ${await res.text().catch(() => "")}`);
    throw Object.assign(new Error("transcribe"), { status: res.status });
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", deltas = "", final: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (typeof ev.type === "string" && ev.type.endsWith(".delta")) deltas += ev.delta ?? "";
        if (typeof ev.type === "string" && ev.type.endsWith(".done")) final = ev.text ?? deltas;
        if (ev.type === "error") throw Object.assign(new Error("transcribe"), { status: 500 });
      } catch (e) {
        if ((e as { status?: number }).status) throw e;
      }
    }
  }
  return (final ?? deltas).trim();
}

const statusMessage = (s?: number) =>
  s === 402 ? "Hết lượt AI của ứng dụng, tạm thời hãy nhập tay nhé." : s === 429 ? "AI đang bận, thử lại sau ít phút nhé." : "Không nhận diện được giọng nói, thử nói lại nhé.";

/** Signed-in user: speech → text → draft transaction fields. Never saves anything; audio is not stored. */
export const parseVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<VoiceResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "Chưa cấu hình AI." };
    const { understand, AiError } = await import("./telegram/ai.server");
    const { parseSpokenVnd, SLANG_HINT } = await import("./vn-money");
    const { vnClock } = await import("./telegram/time");

    let text: string;
    try {
      const bin = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
      text = await transcribe(bin, data.mime, apiKey);
    } catch (e) {
      return { ok: false, error: statusMessage((e as { status?: number }).status) };
    }
    if (!text) return { ok: false, error: "Không nghe rõ, bạn nói lại gần micro hơn nhé." };

    const [{ data: wallets }, { data: cats }] = await Promise.all([
      context.supabase.from("wallets").select("id,name,archived_at"),
      context.supabase.from("categories").select("id,name,type,archived_at"),
    ]);
    const ws = (wallets ?? []).filter((w) => !w.archived_at);
    const cs = (cats ?? []).filter((c) => !c.archived_at);
    const fallback = parseSpokenVnd(text);
    let intent;
    try {
      intent = await understand({
        text: `${text}\n(${SLANG_HINT})`,
        wallets: ws.map((w) => w.name),
        categories: cs.map((c) => ({ name: c.name, type: c.type })),
        nowLocal: (() => { const c = vnClock(new Date()); return `${c.date} ${c.hour}h`; })(),
      });
    } catch (e) {
      if (fallback) return { ok: true, text, type: "expense", amount: fallback, categoryId: null, walletId: null, note: text, occurredAt: null };
      return { ok: false, error: e instanceof AiError ? statusMessage(e.status) : statusMessage() };
    }
    const type = intent.type === "income" ? "income" : intent.type === "expense" ? "expense" : fallback || intent.amount_vnd ? "expense" : null;
    const find = <T extends { name: string }>(list: T[], n: string | null) => (n ? list.find((x) => x.name.toLowerCase() === n.toLowerCase()) : undefined);
    return {
      ok: true,
      text,
      type,
      amount: intent.amount_vnd && intent.amount_vnd > 0 ? intent.amount_vnd : fallback,
      categoryId: find(cs.filter((c) => c.type === (type ?? "expense")), intent.category)?.id ?? null,
      walletId: find(ws, type === "income" ? intent.dest_wallet ?? intent.wallet : intent.wallet)?.id ?? null,
      note: intent.note,
      occurredAt: intent.occurred_at,
    };
  });
