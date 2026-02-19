import { afterEach, describe, expect, it, vi } from "vitest";

import { enhanceWithOpenAi } from "@/lib/openai-enhance";
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
    colors: [{ value: "#101010", count: 12 }],
    typography: {
      families: [{ value: "Inter", count: 6 }],
      sizes: [{ value: "16", count: 8 }],
      weights: [{ value: "400", count: 5 }],
      line_heights: [{ value: "24", count: 4 }],
    },
    spacing: [{ value: "24", count: 4 }],
    radii: [{ value: "8", count: 3 }],
    shadows: [{ value: "0 2px 6px rgba(0,0,0,.1)", count: 2 }],
    borders: [{ value: "1px solid #101010", count: 1 }],
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

function validEnhancementPayload() {
  return {
    prompt: "Build a semantic layout based on the source site's theme.",
    summary: "Refined summary",
    designBlueprint: {
      themeReference: "Based on the source site's theme and structural patterns.",
      colors: ["#101010", "#202020"],
      typography: ["Inter"],
      effects: ["shadow-sm"],
      htmlStructure: ["Header", "Hero"],
    },
    tokensJson: {
      schema_version: "1.0",
      generated_at: "2026-02-16T00:00:00.000Z",
      source_url: "https://example.com",
      design_prompt: "Prompt",
      tokens: {
        color: {
          palette: ["#101010"],
          roles: {},
        },
        typography: {
          families: ["Inter"],
          scale: [16],
          weights: [400],
          line_heights: [24],
        },
        spacing: [24],
        radius: [8],
        shadow: ["0 2px 6px rgba(0,0,0,.1)"],
        effects: ["blur(8px)"],
      },
      components: {},
      sections: [{ label: "Hero", selector: "main.hero", width: 1200, height: 700 }],
      notes: ["Note"],
      assumptions: ["Assumption"],
    },
    starterHtmlCss: "",
  };
}

function makeFetchResponse(content: string) {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        choices: [{ message: { content } }],
      }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.LLM_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANALYZE_LLM_MAX_ATTEMPTS;
});

describe("enhanceWithOpenAi", () => {
  it("returns strict attempt output when valid", async () => {
    process.env.LLM_API_KEY = "test-key";
    const payload = validEnhancementPayload();
    const fetchMock = vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify(payload)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await enhanceWithOpenAi(pack);

    expect(result.summary).toBe("Refined summary");
    expect(result.llmTiming?.final_path).toBe("strict_success");
    expect(result.llmTiming?.attempt_count).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses repair attempt when strict output is invalid", async () => {
    process.env.LLM_API_KEY = "test-key";
    const payload = validEnhancementPayload();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeFetchResponse("{ not_json"))
      .mockResolvedValueOnce(makeFetchResponse(JSON.stringify(payload)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await enhanceWithOpenAi(pack);

    expect(result.summary).toBe("Refined summary");
    expect(result.llmTiming?.final_path).toBe("repair_success");
    expect(result.llmTiming?.attempt_count).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back deterministically when strict request fails and retries are disabled", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.ANALYZE_LLM_MAX_ATTEMPTS = "1";
    const fetchMock = vi.fn().mockRejectedValue(new Error("network failed"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await enhanceWithOpenAi(pack);

    expect(result.summary).toContain("LLM refinement skipped");
    expect(result.llmTiming?.final_path).toBe("deterministic_fallback");
    expect(result.llmTiming?.attempt_count).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
