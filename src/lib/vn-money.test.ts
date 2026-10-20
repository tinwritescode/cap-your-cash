import { describe, expect, it } from "vitest";
import { parseSpokenVnd } from "./vn-money";

describe("parseSpokenVnd", () => {
  it("ba củ = 3 triệu", () => expect(parseSpokenVnd("Tiền nhà ba củ")).toBe(3_000_000));
  it("hai xị = 200 nghìn", () => expect(parseSpokenVnd("nhậu hai xị")).toBe(200_000));
  it("hai chai rưỡi = 2,5 triệu", () => expect(parseSpokenVnd("hai chai rưỡi")).toBe(2_500_000));
  it("ba chục = 30 nghìn", () => expect(parseSpokenVnd("cà phê ba chục")).toBe(30_000));
  it("35k = 35 nghìn", () => expect(parseSpokenVnd("bánh mì 35k")).toBe(35_000));
  it("1tr2 = 1,2 triệu", () => expect(parseSpokenVnd("1tr2")).toBe(1_200_000));
  it("no amount", () => expect(parseSpokenVnd("đi chợ")).toBeNull());
});
