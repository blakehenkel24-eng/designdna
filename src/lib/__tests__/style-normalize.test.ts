import { describe, expect, it } from "vitest";

import {
  normalizeColor,
  normalizeFontFamily,
  normalizeFontWeight,
  normalizeShadow,
  parsePxList,
} from "@/lib/extractor/style-normalize";

describe("style-normalize", () => {
  it("normalizes rgb and rgba colors", () => {
    expect(normalizeColor("rgb(17, 34, 51)")).toEqual({ hex: "#112233" });
    expect(normalizeColor("rgba(17, 34, 51, 0.5)")).toEqual({
      hex: "#112233",
      alpha: 0.5,
    });
  });

  it("normalizes font families and weights", () => {
    expect(normalizeFontFamily('"Inter", Arial, sans-serif')).toBe("Inter");
    expect(normalizeFontWeight("bold")).toBe(700);
    expect(normalizeFontWeight("500")).toBe(500);
  });

  it("parses px shorthand values and shadows", () => {
    expect(parsePxList("0px 16px 24px 8px")).toEqual([0, 16, 24, 8]);

    const shadow = normalizeShadow("0px 8px 24px rgba(0,0,0,0.2)")[0];
    expect(shadow).toEqual({
      x: 0,
      y: 8,
      blur: 24,
      spread: undefined,
      color: "#000000",
      alpha: 0.2,
      inset: undefined,
    });
  });
});
