import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Hourly job: Telegram budget alerts, 20h reminder, 21h daily summary, Sunday 21h weekly summary
// (Vietnam time), plus cleanup of expired login codes, stale drafts and webhook ids.
export const Route = createFileRoute("/api/public/jobs/telegram-notify")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const bot = await import("@/lib/telegram/bot.server");
        const { sendMessage } = await import("@/lib/telegram/api.server");
        const { vnClock } = await import("@/lib/telegram/time");
        const { date, hour, weekday } = vnClock();

        const { data: links } = await db.from("telegram_links").select("*").limit(1000);
        let sent = 0;
        for (const l of links ?? []) {
          try {
            if (l.notify_budget) await bot.checkBudget(db, l);
            if (l.notify_reminder && hour >= 20 && l.last_reminder_on !== date) {
              const today = await bot.rangeReport(db, l.user_id, "today");
              if (Number(today.all_count) === 0) {
                await sendMessage(l.chat_id, "✍️ Hôm nay bạn chưa ghi khoản nào. Nhắn kiểu <i>ăn tối 60k</i> hoặc gửi ảnh hoá đơn để ghi nhanh nhé.");
                sent++;
              }
              await db.from("telegram_links").update({ last_reminder_on: date }).eq("user_id", l.user_id);
            }
            if (l.notify_daily && hour >= 21 && l.last_daily_on !== date) {
              await sendMessage(l.chat_id, `🌙 ${await bot.spendingText(db, l.user_id, "today", true, "Tổng kết hôm nay")}`);
              await db.from("telegram_links").update({ last_daily_on: date }).eq("user_id", l.user_id);
              sent++;
            }
            if (l.notify_weekly && weekday === 0 && hour >= 21 && l.last_weekly_on !== date) {
              await sendMessage(l.chat_id, `🗓 ${await bot.spendingText(db, l.user_id, "week", true, "Tổng kết tuần")}`);
              await db.from("telegram_links").update({ last_weekly_on: date }).eq("user_id", l.user_id);
              sent++;
            }
          } catch (e) {
            console.error("telegram notify failed", l.user_id, e);
          }
        }

        // Housekeeping
        const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
        await db.from("telegram_codes").delete().lt("expires_at", dayAgo);
        await db.from("telegram_updates").delete().lt("created_at", new Date(Date.now() - 3 * 86_400_000).toISOString());
        const { data: stale } = await db.from("telegram_drafts").select("id, draft").lt("created_at", dayAgo).limit(200);
        const paths = (stale ?? []).flatMap((s) => ((s.draft as { photos?: { original_path: string }[] }).photos ?? []).map((p) => p.original_path));
        if (paths.length) await db.storage.from("photos").remove(paths);
        if (stale?.length) await db.from("telegram_drafts").delete().in("id", stale.map((s) => s.id));

        return Response.json({ ok: true, sent });
      },
    },
  },
});
