import { describe, expect, it } from "vitest";

import { buildRecreationPrompt } from "@/lib/prompt";
import type { DesignDnaPack } from "@/lib/types";

const pack: DesignDnaPack = {
  meta: {
    url: "https://example.com",
    captured_at: "2026-02-16T00:00:00.000Z",
    capture_version: "design_dna_pack_v1",
    viewport: { width: 1440, height: 900 },
    compliance_flags: {
      robots_allowed: true,
      blocked: false,
    },
  },
  design_tokens: {
    colors: [{ value: "rgb(0, 0, 0)", count: 12 }],
    typography: {
      families: [{ value: "Inter", count: 6 }],
      sizes: [{ value: "16px", count: 8 }],
      weights: [{ value: "400", count: 5 }],
      line_heights: [{ value: "24px", count: 4 }],
    },
    spacing: [{ value: "24px", count: 4 }],
    radii: [{ value: "8px", count: 3 }],
    shadows: [{ value: "0 2px 6px rgba(0,0,0,.1)", count: 2 }],
    borders: [{ value: "1px solid rgb(0,0,0)", count: 1 }],
    effects: [{ value: "blur(8px)", count: 1 }],
  },
  layout_map: {
    sections: [
      {
        id: "section_1",
        selector: "main.hero",
        role: "main",
        bounds: { x: 0, y: 0, width: 1200, height: 700 },
        children: ["h1", "p", "button"],
        responsive_hints: ["full width"],
      },
    ],
  },
  components: [
    {
      id: "component_1",
      selector: "button.cta",
      type: "button",
      text_preview: "Get started",
      style_signature: "fontSize:16px;color:#fff",
    },
  ],
  assets: {
    images: [{ url: "https://example.com/hero.png", selector: "img.hero" }],
    fonts: [{ family: "Inter", source: "loaded" }],
    icons: [{ url: "https://example.com/favicon.ico", rel: "icon" }],
  },
  content_summary: {
    title: "Example",
    headings: ["Build faster"],
    buttons: ["Get started"],
    nav_items: ["Home"],
  },
  recreation_guidance: {
    objective: "Recreate page",
    constraints: ["Semantic HTML"],
    warnings: [],
  },
  confidence: {
    overall: 0.82,
    sections: [{ section_id: "section_1", score: 0.8 }],
  },
  vision_summary: {
    dominant_colors: ["#000000", "#ffffff"],
    notes: ["Use contrast"],
  },
};

describe("buildRecreationPrompt", () => {
  it("is deterministic for the same input", () => {
    const first = buildRecreationPrompt(pack);
    const second = buildRecreationPrompt(pack);

    expect(first).toEqual(second);
    expect(first).toContain("Target URL: https://example.com");
    expect(first).toContain("Now produce the recreated HTML and CSS.");
  });
});
