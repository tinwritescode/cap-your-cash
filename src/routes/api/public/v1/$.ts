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
const PhotoIn = z.union([z.string(), z.object({ data: z.string(), content_type: z.string().optional() })]);
const PHOTO_ACTIONS = new Set(["transactions.create", "transactions.photos.add"]);
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function dispatch(key: string, action: string, args: Record<string, unknown>) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/api_dispatch`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ p_key: key, p_action: action, p_args: args }),
  });
  return { res, data: await res.json().catch(() => null) };
}

function decodePhoto(raw: unknown): { bytes: Uint8Array; type: string } | string {
  const p = PhotoIn.safeParse(raw);
  if (!p.success) return "Ảnh phải là chuỗi base64 hoặc { data, content_type }";
  let data = typeof p.data === "string" ? p.data : p.data.data;
  let type = typeof p.data === "string" ? "image/jpeg" : (p.data.content_type ?? "image/jpeg");
  const m = /^data:([\w/+.-]+);base64,/.exec(data);
  if (m) { type = m[1]; data = data.slice(m[0].length); }
  if (!TYPES[type]) return "Chỉ nhận ảnh JPEG, PNG hoặc WebP";
  let bin: string;
  try { bin = atob(data.replace(/\s/g, "")); } catch { return "Ảnh base64 không hợp lệ"; }
  if (bin.length === 0 || bin.length > MAX_PHOTO_BYTES) return "Mỗi ảnh phải nhỏ hơn 6MB";
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  const webp = bin.slice(8, 12) === "WEBP";
  if (!(jpeg || png || webp)) return "Dữ liệu không phải ảnh hợp lệ";
  return { bytes, type: jpeg ? "image/jpeg" : png ? "image/png" : "image/webp" };
}

// Uploads photos to <uid>/<txId>/<photoId> after the key is verified, and returns
// the metadata the transaction RPCs expect. Upload happens before the RPC commits.
async function uploadPhotos(key: string, args: Record<string, unknown>) {
  const list = args.photos;
  if (list === undefined) return { paths: [] as string[] };
  if (!Array.isArray(list) || list.length === 0 || list.length > 5) return { error: "photos phải là mảng 1–5 ảnh" };
  const decoded = list.map(decodePhoto);
  const bad = decoded.find((d) => typeof d === "string");
  if (bad) return { error: bad as string };
  const me = await dispatch(key, "me", {});
  const uid = me.data?.id as string | undefined;
  if (!me.res.ok || !uid) return { error: "API key không hợp lệ hoặc đã bị thu hồi", status: 401 };
  if (!args.id) args.id = crypto.randomUUID();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const paths: string[] = [];
  const meta = [];
  for (const [i, d] of (decoded as { bytes: Uint8Array; type: string }[]).entries()) {
    const photoId = crypto.randomUUID();
    const path = `${uid}/${args.id}/${photoId}.${TYPES[d.type]}`;
    const { error } = await supabaseAdmin.storage.from("photos").upload(path, d.bytes, { contentType: d.type, upsert: false });
    if (error) {
      if (paths.length) await supabaseAdmin.storage.from("photos").remove(paths);
      return { error: "Tải ảnh lên thất bại", status: 500 };
    }
    paths.push(path);
    meta.push({ id: photoId, original_path: path, thumb_path: path, sort_order: 100 + i });
  }
  args.photos = meta;
  return { paths };
}

async function handle(request: Request, splat: string | undefined) {
  const key = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!/^cm_[a-f0-9]{64}$/.test(key)) return json({ error: "Thiếu hoặc sai API key" }, 401);

  const m = matchEndpoint(request.method, splat ?? "");
  if (!m) return json({ error: `Không có endpoint ${request.method} ${API_BASE_PATH}/${splat ?? ""}` }, 404);

  const url = new URL(request.url);
  const args: Record<string, unknown> = Object.fromEntries(url.searchParams);
  if (request.method !== "GET" && request.method !== "DELETE") {
    const text = await request.text();
    if (text.length > (PHOTO_ACTIONS.has(m.ep.action) ? 45_000_000 : 20_000)) return json({ error: "Body quá lớn" }, 413);
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

  let uploaded: string[] = [];
  if (PHOTO_ACTIONS.has(m.ep.action)) {
    if (m.ep.action === "transactions.photos.add" && args.photos === undefined) return json({ error: "Thiếu photos" }, 400);
    if (args.id !== undefined && !z.string().uuid().safeParse(args.id).success) return json({ error: "id không hợp lệ" }, 400);
    const up = await uploadPhotos(key, args);
    if ("error" in up) return json({ error: up.error }, up.status ?? 400);
    uploaded = up.paths;
  }

  const { res, data } = await dispatch(key, m.ep.action, args);
  const failed = !res.ok || (data && typeof data === "object" && "status" in data && data.status === "conflict");
  if (failed && uploaded.length) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from("photos").remove(uploaded);
  }
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
