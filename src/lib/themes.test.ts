import { describe, expect, it } from "vitest";
import { ACCENTS, FONTS, checkAccent, contrast } from "./themes";

describe("themes", () => {
  it("black on white is 21:1", () => {
    expect(contrast([0, 0, 0], [1, 0, 0])).toBeCloseTo(21, 0);
  });
  it("chart bars meet 3:1 in both modes for every accent", () => {
    for (const a of ACCENTS) expect(checkAccent(a).filter((i) => i.need === 3)).toEqual([]);
  });
  it("offers 20 fonts", () => {
    expect(FONTS).toHaveLength(20);
  });
});
