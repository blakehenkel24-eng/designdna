import { describe, expect, it } from "vitest";

import { compileStitchPrompt } from "@/lib/compile-stitch";
import type { StyleSpec } from "@/lib/types";

const styleSpec: StyleSpec = {
  url: "https://example.com",
  viewport: { width: 1440, height: 900 },
  palette: {
    colors: [
      { hex: "#0f172a", usageHint: "textPrimary", weight: 20 },
      { hex: "#f8fafc", usageHint: "background", weight: 15 },
      { hex: "#2563eb", usageHint: "primary", weight: 8 },
    ],
    roles: {
      primary: "#2563eb",
      background: "#f8fafc",
      textPrimary: "#0f172a",
      border: "#cbd5e1",
    },
  },
  typography: {
    primaryFamily: "Inter",
    secondaryFamily: "Georgia",
    scale: [
      { px: 48, roleHint: "h1", weight: 12 },
      { px: 20, roleHint: "h3", weight: 9 },
      { px: 16, roleHint: "body", weight: 14 },
    ],
    weights: [400, 500, 700],
    lineHeights: [{ value: 1.5, unit: "number" }],
  },
  tokens: {
    spacingPx: [
      { value: 8, weight: 12 },
      { value: 16, weight: 15 },
      { value: 32, weight: 9 },
    ],
    radiusPx: [{ value: 8, weight: 10 }],
    shadows: [{ value: "0px 8px 24px #00000033", weight: 6 }],
    effects: [{ value: "blur(12px)", weight: 3 }],
  },
  layout: {
    containerWidth: 1200,
    sectionVerticalSpacing: [48, 64],
    gridPatterns: ["grid:repeat(3,minmax(0,1fr))"],
  },
  components: {
    primaryButton: {
      selector: "button.cta",
      type: "primary_button",
      background_color: "#2563eb",
      text_color: "#ffffff",
      radius_px: 8,
      padding_x_px: 20,
      padding_y_px: 12,
      font_size_px: 16,
      font_weight: 600,
    },
  },
  sections: [
    {
      label: "Hero",
      selector: "section.hero",
      bounds: { x: 0, y: 0, width: 1200, height: 640 },
    },
  ],
};

describe("compileStitchPrompt", () => {
  it("renders deterministic stitch-specific sections", () => {
    const prompt = compileStitchPrompt(styleSpec);

    expect(prompt).toContain("Goal:");
    expect(prompt).toContain("Component recipes");
    expect(prompt).toContain("Responsive rules:");
    expect(prompt).toContain("Based on the source site's theme;");
    expect(prompt).toContain("button.cta");
  });
});
