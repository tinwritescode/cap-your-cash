import { describe, expect, it } from "vitest";
import { challengeUsable, resolveRp } from "./passkey-rp";

describe("resolveRp", () => {
  it("accepts the custom domain", () => {
    expect(resolveRp("https://money.tyvn.online")).toEqual({ rpID: "money.tyvn.online", origin: "https://money.tyvn.online" });
  });
  it("rejects foreign domains", () => {
    expect(() => resolveRp("https://evil.example.com")).toThrow();
  });
  it("rejects plain http outside localhost", () => {
    expect(() => resolveRp("http://money.tyvn.online")).toThrow();
  });
});

describe("challengeUsable", () => {
  const now = Date.parse("2026-10-17T00:00:00Z");
  it("rejects expired challenge", () => {
    expect(challengeUsable({ expires_at: "2026-10-16T23:59:00Z", used_at: null }, now)).toBe(false);
  });
  it("rejects reused challenge", () => {
    expect(challengeUsable({ expires_at: "2026-10-17T00:04:00Z", used_at: "2026-10-16T23:59:30Z" }, now)).toBe(false);
  });
  it("accepts fresh challenge", () => {
    expect(challengeUsable({ expires_at: "2026-10-17T00:04:00Z", used_at: null }, now)).toBe(true);
  });
});
