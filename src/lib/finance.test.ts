import { describe, expect, it } from "vitest";
import { computeBudget, csvCell, dayKey, monthRange, parseVnd } from "./finance";

describe("Vietnam time boundaries", () => {
  it("23:30 local on Jul 31 is still July 31", () => {
    // 2026-07-31 23:30 +07 = 16:30Z
    expect(dayKey("2026-07-31T16:30:00Z")).toBe("2026-07-31");
  });
  it("00:10 local on Aug 1 belongs to Aug 1 even though UTC is Jul 31", () => {
    expect(dayKey("2026-07-31T17:10:00Z")).toBe("2026-08-01");
  });
  it("July month range starts at Jun 30 17:00Z", () => {
    const r = monthRange(2026, 7);
    expect(r.start.toISOString()).toBe("2026-06-30T17:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-07-31T17:00:00.000Z");
  });
});

describe("budget", () => {
  const now = new Date("2026-07-08T05:00:00Z"); // Jul 8 local
  it("current month daily allowance divides by remaining days including today", () => {
    const b = computeBudget(2_400_000, 0, 2026, 7, now);
    expect(b.kind === "set" && b.daysLeft).toBe(24);
    expect(b.kind === "set" && b.daily).toBe(100_000);
  });
  it("past month hides daily allowance", () => {
    const b = computeBudget(1_000_000, 200_000, 2026, 6, now);
    expect(b.kind === "set" && b.daily).toBe(null);
  });
  it("future month divides by full month", () => {
    const b = computeBudget(3_100_000, 0, 2026, 8, now);
    expect(b.kind === "set" && b.daily).toBe(100_000);
  });
  it("overspending gives negative remaining and zero daily", () => {
    const b = computeBudget(100_000, 150_000, 2026, 7, now);
    expect(b.kind === "set" && b.remaining).toBe(-50_000);
    expect(b.kind === "set" && b.daily).toBe(0);
    expect(b.kind === "set" && b.exceeded).toBe(true);
  });
  it("zero budget does not divide by zero", () => {
    const b = computeBudget(0, 10_000, 2026, 7, now);
    expect(b.kind === "set" && b.zeroBudget).toBe(true);
    expect(b.kind === "set" && b.percent).toBe(100);
  });
  it("no budget", () => {
    expect(computeBudget(null, 5, 2026, 7, now).kind).toBe("none");
  });
});

describe("amount parsing", () => {
  it("parses separators into whole dong", () => {
    expect(parseVnd("1.200.000")).toBe(1_200_000);
    expect(parseVnd("")).toBe(null);
  });
});

describe("CSV", () => {
  it("neutralises formulas and quotes", () => {
    expect(csvCell("=SUM(A1)", true)).toBe("'=SUM(A1)");
    expect(csvCell('a,"b"', true)).toBe('"a,""b"""');
  });
});
