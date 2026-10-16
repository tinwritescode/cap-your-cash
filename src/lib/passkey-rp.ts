/** Relying-party resolution for passkeys. A passkey is bound to the exact host it was created on. */
const ALLOWED_HOSTS = [/^money\.tyvn\.online$/, /^cap-money\.lovable\.app$/, /^[a-z0-9-]+\.lovable\.app$/, /^localhost$/];

export const CHALLENGE_TTL_MS = 5 * 60_000;

export function resolveRp(origin: string | null | undefined): { rpID: string; origin: string } {
  if (!origin) throw new Error("Thiếu nguồn yêu cầu");
  let url: URL;
  try { url = new URL(origin); } catch { throw new Error("Nguồn yêu cầu không hợp lệ"); }
  const host = url.hostname;
  const secure = url.protocol === "https:" || host === "localhost";
  if (!secure || !ALLOWED_HOSTS.some((r) => r.test(host))) throw new Error("Tên miền không được phép dùng passkey");
  return { rpID: host, origin: url.origin };
}

export function challengeUsable(c: { expires_at: string; used_at: string | null }, now = Date.now()) {
  return !c.used_at && new Date(c.expires_at).getTime() > now;
}
