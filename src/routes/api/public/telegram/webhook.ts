import { createFileRoute } from "@tanstack/react-router";

// Telegram bot webhook. Telegram signs every delivery with the secret token we
// registered (derived from the connection key); anything else is rejected.
export const Route = createFileRoute("/api/public/telegram/webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { webhookSecret } = await import("@/lib/telegram/api.server");
        const expected = await webhookSecret();
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (actual.length !== expected.length || actual !== expected) return new Response("Unauthorized", { status: 401 });

        let update: unknown;
        try { update = await request.json(); } catch { return Response.json({ ok: true, ignored: true }); }
        if (!update || typeof update !== "object" || typeof (update as { update_id?: unknown }).update_id !== "number") {
          return Response.json({ ok: true, ignored: true });
        }
        const { handleUpdate } = await import("@/lib/telegram/bot.server");
        await handleUpdate(update as Parameters<typeof handleUpdate>[0]);
        return Response.json({ ok: true });
      },
    },
  },
});
