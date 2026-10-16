// Vietnam-time period boundaries for bot reports and notifications (UTC+7, no DST).
import { localMidnightUtc, toLocal } from "../finance";

export type Period = "today" | "yesterday" | "week" | "month" | "last_month";

export const PERIOD_LABEL: Record<Period, string> = {
  today: "Hôm nay",
  yesterday: "Hôm qua",
  week: "Tuần này",
  month: "Tháng này",
  last_month: "Tháng trước",
};

/** Start (inclusive) and end (exclusive) of a period in Asia/Ho_Chi_Minh. Weeks start on Monday. */
export function periodRange(period: Period, now = new Date()): { from: Date; to: Date } {
  const l = toLocal(now);
  const today = localMidnightUtc(l.y, l.m, l.d);
  const day = 86_400_000;
  switch (period) {
    case "today":
      return { from: today, to: new Date(today.getTime() + day) };
    case "yesterday":
      return { from: new Date(today.getTime() - day), to: today };
    case "week": {
      const dow = (new Date(Date.UTC(l.y, l.m - 1, l.d)).getUTCDay() + 6) % 7; // Monday = 0
      const from = new Date(today.getTime() - dow * day);
      return { from, to: new Date(from.getTime() + 7 * day) };
    }
    case "month":
      return { from: localMidnightUtc(l.y, l.m, 1), to: l.m === 12 ? localMidnightUtc(l.y + 1, 1, 1) : localMidnightUtc(l.y, l.m + 1, 1) };
    case "last_month":
      return { from: l.m === 1 ? localMidnightUtc(l.y - 1, 12, 1) : localMidnightUtc(l.y, l.m - 1, 1), to: localMidnightUtc(l.y, l.m, 1) };
  }
}

/** Vietnam-local date (YYYY-MM-DD), hour and weekday (0 = Sunday). */
export function vnClock(now = new Date()) {
  const l = toLocal(now);
  const date = `${l.y}-${String(l.m).padStart(2, "0")}-${String(l.d).padStart(2, "0")}`;
  return { date, hour: l.hh, weekday: new Date(Date.UTC(l.y, l.m - 1, l.d)).getUTCDay(), monthStart: `${date.slice(0, 7)}-01` };
}

/** Budget alert level: 0 below 80%, 1 at 80%+, 2 at 100%+. */
export function budgetLevel(expense: number, budget: number | null | undefined): 0 | 1 | 2 {
  if (!budget || budget <= 0) return 0;
  if (expense >= budget) return 2;
  if (expense >= budget * 0.8) return 1;
  return 0;
}
