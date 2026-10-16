import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { API_BASE_PATH, matchEndpoint } from "@/lib/agent-api";

// Public Agent API. Every call is authenticated inside the database by API key hash
// (public.api_dispatch), which scopes all reads/writes to the key owner.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const Body = z.record(z.string(), z.unknown());

async function handle(request: Request, splat: string | undefined) {
  const key = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!/^cm_[a-f0-9]{64}$/.test(key)) return json({ error: "Thiếu hoặc sai API key" }, 401);

  const m = matchEndpoint(request.method, splat ?? "");
  if (!m) return json({ error: `Không có endpoint ${request.method} ${API_BASE_PATH}/${splat ?? ""}` }, 404);

  const url = new URL(request.url);
  const args: Record<string, unknown> = Object.fromEntries(url.searchParams);
  if (request.method !== "GET" && request.method !== "DELETE") {
    const text = await request.text();
    if (text.length > 20_000) return json({ error: "Body quá lớn" }, 413);
    if (text) {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { return json({ error: "Body không phải JSON" }, 400); }
      const r = Body.safeParse(parsed);
      if (!r.success) return json({ error: "Body phải là object JSON" }, 400);
      Object.assign(args, r.data);
    }
  }
  if (m.id) {
    if (!z.string().uuid().safeParse(m.id).success) return json({ error: "id không hợp lệ" }, 400);
    args.id = m.id;
  }

  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/api_dispatch`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ p_key: key, p_action: m.ep.action, p_args: args }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg: string = data?.message ?? "Lỗi máy chủ";
    const [code, ...rest] = msg.split(":");
    const text = rest.length ? rest.join(":") : msg;
    const status = code === "AUTH" ? 401 : code === "NOT_FOUND" ? 404 : code === "CONFLICT" ? 409 : code === "VALIDATION" || res.status === 400 ? 400 : 500;
    return json({ error: status === 500 ? "Lỗi máy chủ" : text }, status);
  }
  if (data && typeof data === "object" && "status" in data && data.status === "conflict") return json({ error: data.message ?? "Xung đột phiên bản", data }, 409);
  return json({ data }, request.method === "POST" && m.ep.action.endsWith("create") ? 201 : 200);
}

export const Route = createFileRoute("/api/public/v1/$")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: ({ request, params }) => handle(request, params._splat),
      POST: ({ request, params }) => handle(request, params._splat),
      PATCH: ({ request, params }) => handle(request, params._splat),
      PUT: ({ request, params }) => handle(request, params._splat),
      DELETE: ({ request, params }) => handle(request, params._splat),
    },
  },
});
