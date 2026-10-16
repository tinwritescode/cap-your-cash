import { describe, expect, it } from "vitest";
import { budgetLevel, periodRange, vnClock } from "./time";

// 2026-10-16 22:47 in Vietnam = 15:47 UTC (a Friday)
const now = new Date("2026-10-16T15:47:00Z");

describe("telegram periods (Asia/Ho_Chi_Minh)", () => {
  it("today starts at local midnight", () => {
    const r = periodRange("today", now);
    expect(r.from.toISOString()).toBe("2026-10-15T17:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-16T17:00:00.000Z");
  });
  it("week starts on Monday", () => {
    expect(periodRange("week", now).from.toISOString()).toBe("2026-10-11T17:00:00.000Z");
  });
  it("month covers the local month", () => {
    const r = periodRange("month", now);
    expect(r.from.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  });
  it("local clock uses Vietnam time", () => {
    expect(vnClock(now)).toMatchObject({ date: "2026-10-16", hour: 22, weekday: 5 });
  });
});

describe("budget alert levels", () => {
  it("warns at 80% and at 100%", () => {
    expect(budgetLevel(790_000, 1_000_000)).toBe(0);
    expect(budgetLevel(800_000, 1_000_000)).toBe(1);
    expect(budgetLevel(1_000_000, 1_000_000)).toBe(2);
    expect(budgetLevel(5_000_000, null)).toBe(0);
  });
});
