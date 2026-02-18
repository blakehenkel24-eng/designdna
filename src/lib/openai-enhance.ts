import { z } from "zod";

import { compileStitchPrompt } from "@/lib/compile-stitch";
import { buildRecreationPrompt } from "@/lib/prompt";
import {
  llmEnhancementSchema,
  type SemanticTokensJson,
} from "@/lib/schema/styleSpec.schema";
import { buildSemanticTokensJson } from "@/lib/tokens-json";
import type { DesignDnaPack } from "@/lib/types";

type PrototypeResult = {
  prompt: string;
  summary: string;
  designBlueprint: {
    themeReference: string;
    colors: string[];
    typography: string[];
    effects: string[];
    htmlStructure: string[];
  };
  tokensJson: SemanticTokensJson;
  starterHtmlCss?: string;
};

type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function buildSystemPrompt(includeStarterHtml: boolean) {
  return [
    "You are a design-spec compiler.",
    "Input is already normalized style data. Do not invent core facts.",
    "Your job is semantic labeling and packaging only.",
    "Return one strict JSON object with keys: prompt, summary, designBlueprint, tokensJson, starterHtmlCss.",
    "Prompt must be Stitch-oriented and must include explicit layout, tokens, component recipes, and responsive rules.",
    "Prompt language must say 'based on the source site's theme' and must not claim to clone proprietary branding.",
    includeStarterHtml
      ? "starterHtmlCss may contain an optional small starter scaffold."
      : "starterHtmlCss must be an empty string.",
    "No markdown fences. No extra keys.",
  ].join(" ");
}

function buildSummaryFromPack(pack: DesignDnaPack) {
  const sections = pack.style_spec?.sections.length ?? pack.layout_map.sections.length;
  const colors = pack.style_spec?.palette.colors.length ?? pack.design_tokens.colors.length;
  const families =
    pack.style_spec?.typography.primaryFamily ??
    pack.design_tokens.typography.families[0]?.value ??
    "system-ui";

  return `Theme-based design spec compiled from ${sections} sections and ${colors} core colors. Primary type direction: ${families}.`;
}

function blueprintFromTokens(tokensJson: SemanticTokensJson) {
  return {
    themeReference: "Based on the source site's theme and structural patterns.",
    colors: tokensJson.tokens.color.palette.slice(0, 12),
    typography: tokensJson.tokens.typography.families.slice(0, 8),
    effects: [
      ...tokensJson.tokens.shadow.slice(0, 4),
      ...tokensJson.tokens.effects.slice(0, 4),
    ].slice(0, 8),
    htmlStructure: tokensJson.sections.map((section) => section.label).slice(0, 12),
  };
}

function buildFallbackTokensJson(pack: DesignDnaPack, prompt: string): SemanticTokensJson {
  if (pack.style_spec) {
    return buildSemanticTokensJson({ styleSpec: pack.style_spec, designPrompt: prompt });
  }

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    source_url: pack.meta.url,
    design_prompt: prompt,
    tokens: {
      color: {
        palette: pack.design_tokens.colors.slice(0, 12).map((item) => item.value),
        roles: {},
      },
      typography: {
        families: pack.design_tokens.typography.families.slice(0, 8).map((item) => item.value),
        scale: pack.design_tokens.typography.sizes
          .slice(0, 10)
          .map((item) => Number.parseFloat(item.value))
          .filter((value) => Number.isFinite(value)),
        weights: pack.design_tokens.typography.weights
          .slice(0, 10)
          .map((item) => Number.parseFloat(item.value))
          .filter((value) => Number.isFinite(value)),
        line_heights: pack.design_tokens.typography.line_heights
          .slice(0, 10)
          .map((item) => Number.parseFloat(item.value))
          .filter((value) => Number.isFinite(value)),
      },
      spacing: pack.design_tokens.spacing
        .slice(0, 12)
        .map((item) => Number.parseFloat(item.value))
        .filter((value) => Number.isFinite(value)),
      radius: pack.design_tokens.radii
        .slice(0, 12)
        .map((item) => Number.parseFloat(item.value))
        .filter((value) => Number.isFinite(value)),
      shadow: pack.design_tokens.shadows.slice(0, 8).map((item) => item.value),
      effects: pack.design_tokens.effects.slice(0, 8).map((item) => item.value),
    },
    components: {},
    sections: pack.layout_map.sections.slice(0, 12).map((section) => ({
      label: section.role,
      selector: section.selector,
      width: Math.round(section.bounds.width),
      height: Math.round(section.bounds.height),
    })),
    notes: [
      "Fallback token payload generated without style-spec enrichment.",
      "Use as directional guidance and adapt proprietary branding.",
    ],
    assumptions: ["Fallback was used because style_spec was not available."],
  };
}

function buildDeterministicResult(pack: DesignDnaPack): PrototypeResult {
  const prompt = pack.style_spec
    ? compileStitchPrompt(pack.style_spec)
    : buildRecreationPrompt(pack);
  const tokensJson = buildFallbackTokensJson(pack, prompt);

  return {
    prompt,
    summary: buildSummaryFromPack(pack),
    designBlueprint: blueprintFromTokens(tokensJson),
    tokensJson,
    starterHtmlCss: "",
  };
}

function buildUserPayload(pack: DesignDnaPack, deterministic: PrototypeResult) {
  return {
    source_url: pack.meta.url,
    style_spec: pack.style_spec,
    deterministic_prompt: deterministic.prompt,
    deterministic_summary: deterministic.summary,
    deterministic_tokens_json: deterministic.tokensJson,
    request: {
      objective:
        "Refine semantic labels and compile final Stitch prompt without changing core numeric tokens.",
    },
  };
}

function extractContent(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const payload = data as {
    choices?: Array<{
      message?: {
        content?: string | null;
        reasoning_content?: string | null;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content;
  }

  const reasoning = payload.choices?.[0]?.message?.reasoning_content;
  if (typeof reasoning === "string" && reasoning.trim()) {
    return reasoning;
  }

  return null;
}

function parseStrictJson(text: string) {
  return JSON.parse(text.trim());
}

function parseAndValidate(payload: unknown) {
  const parsed = llmEnhancementSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return {
      ok: false as const,
      error: message,
    };
  }

  return {
    ok: true as const,
    value: parsed.data,
  };
}

async function requestCompletion(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  messages: LlmMessage[];
  strictSchema: boolean;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model: input.model,
      temperature: 0.1,
      max_tokens: input.maxTokens,
      messages: input.messages,
      stream: false,
      chat_template_kwargs: {
        thinking:
          (process.env.LLM_CHAT_TEMPLATE_THINKING ?? "false").toLowerCase() ===
          "true",
      },
    };

    if (input.strictSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "design_dna_enhancement",
          strict: true,
          schema: z.toJSONSchema(llmEnhancementSchema),
        },
      };
    }

    const response = await fetch(`${input.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`LLM request failed (${response.status}): ${text}`);
    }

    const data = JSON.parse(text);
    const content = extractContent(data);
    if (!content) {
      throw new Error("LLM response did not contain message content");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeValidatedOutput(
  validated: z.infer<typeof llmEnhancementSchema>,
): PrototypeResult {
  return {
    prompt: validated.prompt,
    summary: validated.summary,
    designBlueprint: validated.designBlueprint,
    tokensJson: validated.tokensJson,
    starterHtmlCss: validated.starterHtmlCss,
  };
}

export async function enhanceWithOpenAi(pack: DesignDnaPack): Promise<PrototypeResult> {
  const deterministic = buildDeterministicResult(pack);
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return deterministic;
  }

  const baseUrl = (process.env.LLM_API_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const includeStarterHtml =
    (process.env.LLM_INCLUDE_STARTER_HTML ?? "false").toLowerCase() === "true";

  const maxTokens = includeStarterHtml ? 2600 : 1800;
  const baseMessages: LlmMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(includeStarterHtml),
    },
    {
      role: "user",
      content: JSON.stringify(buildUserPayload(pack, deterministic)),
    },
  ];

  const attempts: Array<{ strictSchema: boolean; messages: LlmMessage[] }> = [
    { strictSchema: true, messages: baseMessages },
    { strictSchema: false, messages: baseMessages },
  ];

  let lastFailure: string | null = null;

  for (const attempt of attempts) {
    let rawResponse: string;

    try {
      rawResponse = await requestCompletion({
        apiKey,
        baseUrl,
        model,
        maxTokens,
        messages: attempt.messages,
        strictSchema: attempt.strictSchema,
        timeoutMs: 40_000,
      });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : "Unknown LLM error";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = parseStrictJson(rawResponse);
    } catch {
      lastFailure = "Model returned non-JSON output";

      try {
        const repairedRaw = await requestCompletion({
          apiKey,
          baseUrl,
          model,
          maxTokens,
          strictSchema: false,
          timeoutMs: 40_000,
          messages: [
            ...baseMessages,
            {
              role: "assistant",
              content: rawResponse,
            },
            {
              role: "user",
              content:
                "Your previous output was not valid JSON. Return one valid JSON object matching the required schema, no markdown.",
            },
          ],
        });

        parsed = parseStrictJson(repairedRaw);
      } catch (repairError) {
        lastFailure =
          repairError instanceof Error ? repairError.message : "Repair attempt failed";
        continue;
      }
    }

    const validated = parseAndValidate(parsed);
    if (!validated.ok) {
      lastFailure = validated.error;

      try {
        const repairedRaw = await requestCompletion({
          apiKey,
          baseUrl,
          model,
          maxTokens,
          strictSchema: false,
          timeoutMs: 40_000,
          messages: [
            ...baseMessages,
            {
              role: "assistant",
              content: JSON.stringify(parsed),
            },
            {
              role: "user",
              content: `Your previous output failed schema validation (${validated.error}). Return corrected JSON only.`,
            },
          ],
        });

        const repairedParsed = parseStrictJson(repairedRaw);
        const repairedValidated = parseAndValidate(repairedParsed);
        if (repairedValidated.ok) {
          return normalizeValidatedOutput(repairedValidated.value);
        }

        lastFailure = repairedValidated.error;
      } catch (repairError) {
        lastFailure =
          repairError instanceof Error ? repairError.message : "Repair request failed";
      }

      continue;
    }

    return normalizeValidatedOutput(validated.value);
  }

  if (lastFailure) {
    return {
      ...deterministic,
      summary: `${deterministic.summary} LLM refinement skipped (${lastFailure}).`,
    };
  }

  return deterministic;
}
