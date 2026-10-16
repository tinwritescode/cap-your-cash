// Telegram Bot API through the Lovable connector gateway (server-only).
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function headers() {
  const lovable = process.env.LOVABLE_API_KEY;
  const telegram = process.env.TELEGRAM_API_KEY;
  if (!lovable) throw new Error("LOVABLE_API_KEY is not configured");
  if (!telegram) throw new Error("TELEGRAM_API_KEY is not configured");
  return { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": telegram };
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Telegram ${method} failed [${res.status}]: ${text}`);
    throw new Error(`Telegram ${method} failed [${res.status}]`);
  }
  const json = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? "error"}`);
  return json.result;
}

/** Send a message; failures are logged, never thrown (notifications must not break flows). */
export async function sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  try {
    return await tg<{ message_id: number }>("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function downloadFile(fileId: string): Promise<Uint8Array> {
  const file = await tg<{ file_path: string; file_size?: number }>("getFile", { file_id: fileId });
  const res = await fetch(`${GATEWAY_URL}/file/${file.file_path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Telegram file download failed [${res.status}]`);
  return new Uint8Array(await res.arrayBuffer());
}

let botUsername: string | null = null;
export async function getBotUsername() {
  if (!botUsername) botUsername = (await tg<{ username: string }>("getMe")).username;
  return botUsername;
}

async function sha256(text: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Webhook secret derived from the connection key, so setup and handler agree without another secret. */
export async function webhookSecret() {
  const key = process.env.TELEGRAM_API_KEY;
  if (!key) throw new Error("TELEGRAM_API_KEY is not configured");
  return base64url(await sha256(`telegram-webhook:${key}`));
}

export async function hashCode(code: string) {
  return Array.from(await sha256(`capmoney-tg:${code}`), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
