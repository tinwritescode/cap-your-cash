// Pure helpers shared by UI: money, Asia/Ho_Chi_Minh time boundaries, budget math, CSV.
export const TIMEZONE = "Asia/Ho_Chi_Minh";
export const CURRENCY = "VND";
const OFFSET_MS = 7 * 3600 * 1000; // Vietnam has no DST

export const MAX_VND = 9_000_000_000_000_000;

export function formatVnd(n: number | null | undefined): string {
  const v = Math.trunc(Number(n ?? 0));
  return `${v < 0 ? "-" : ""}${Math.abs(v).toLocaleString("en-US")}đ`;
}

/** Parse a user-typed amount ("1.200.000", "1,200,000") into whole dong, or null. */
export function parseVnd(input: string): number | null {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isSafeInteger(n) || n > MAX_VND) return null;
  return n;
}

export type LocalDate = { y: number; m: number; d: number }; // m is 1-12

export function toLocal(date: Date | string): LocalDate & { hh: number; mm: number } {
  const t = new Date(new Date(date).getTime() + OFFSET_MS);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    hh: t.getUTCHours(),
    mm: t.getUTCMinutes(),
  };
}

export function dayKey(date: Date | string): string {
  const l = toLocal(date);
  return `${l.y}-${String(l.m).padStart(2, "0")}-${String(l.d).padStart(2, "0")}`;
}

/** UTC instant of local midnight for y-m-d. */
export function localMidnightUtc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d) - OFFSET_MS);
}

export function monthRange(y: number, m: number): { start: Date; end: Date } {
  return { start: localMidnightUtc(y, m, 1), end: localMidnightUtc(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) };
}

export function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthIso(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Value for <input type="datetime-local"> in Vietnam time. */
export function toLocalInput(date: Date | string): string {
  const l = toLocal(date);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${l.y}-${p(l.m)}-${p(l.d)}T${p(l.hh)}:${p(l.mm)}`;
}
export function fromLocalInput(v: string): Date {
  const [d, t = "00:00"] = v.split("T");
  const [y, m, dd] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, dd, hh, mm) - OFFSET_MS);
}

export function formatDateTime(date: Date | string) {
  const l = toLocal(date);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(l.d)}/${p(l.m)}/${l.y} ${p(l.hh)}:${p(l.mm)}`;
}

export type BudgetState =
  | { kind: "none" }
  | {
      kind: "set";
      budget: number;
      spent: number;
      remaining: number;
      percent: number; // 0..100+ ; 100 when budget is 0 and something spent
      exceeded: boolean;
      zeroBudget: boolean;
      daily: number | null; // null => hidden (past month)
      daysLeft: number | null;
    };

/** Budget math. `now` decides past/current/future month relative to Vietnam time. */
export function computeBudget(
  budget: number | null | undefined,
  spent: number,
  y: number,
  m: number,
  now: Date = new Date(),
): BudgetState {
  if (budget === null || budget === undefined) return { kind: "none" };
  const remaining = budget - spent;
  const zeroBudget = budget === 0;
  const percent = zeroBudget ? (spent > 0 ? 100 : 0) : Math.round((spent / budget) * 100);
  const today = toLocal(now);
  const cur = today.y * 12 + today.m;
  const target = y * 12 + m;
  let daily: number | null = null;
  let daysLeft: number | null = null;
  if (target === cur) {
    daysLeft = daysInMonth(y, m) - today.d + 1;
    daily = Math.floor(Math.max(remaining, 0) / daysLeft);
  } else if (target > cur) {
    daysLeft = daysInMonth(y, m);
    daily = Math.floor(Math.max(remaining, 0) / daysLeft);
  }
  return { kind: "set", budget, spent, remaining, percent, exceeded: spent > budget, zeroBudget, daily, daysLeft };
}

/** CSV cell: quote, escape, and neutralise spreadsheet formulas. */
export function csvCell(v: unknown, isUserText = false): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (isUserText && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s) || s !== s.trim()) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function isoWithOffset(date: Date | string): string {
  const l = toLocal(date);
  const p = (n: number) => String(n).padStart(2, "0");
  const sec = new Date(date).getUTCSeconds();
  return `${l.y}-${p(l.m)}-${p(l.d)}T${p(l.hh)}:${p(l.mm)}:${p(sec)}+07:00`;
}
