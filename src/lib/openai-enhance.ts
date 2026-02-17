import type { DesignDnaPack } from "@/lib/types";

type PrototypeResult = {
  prompt: string;
  summary: string;
  designBlueprint?: {
    themeReference: string;
    colors: string[];
    typography: string[];
    effects: string[];
    htmlStructure: string[];
  };
  starterHtmlCss?: string;
};

function buildSystemPrompt(includeStarterHtml: boolean) {
  return [
    "You are a web design reconstruction assistant.",
    "Given extracted design DNA, produce:",
    "1) a high-quality LLM prompt to recreate the page in semantic HTML+CSS",
    "2) a concise design summary",
    "3) a design blueprint with colors, typography, effects, and HTML structure",
    includeStarterHtml
      ? "4) an optional starter HTML+CSS draft."
      : "4) return starterHtmlCss as an empty string.",
    "The prompt MUST use wording like 'based on the source site's theme' and MUST NOT say 'build X company's website' or imply copying proprietary branding exactly.",
    "The prompt should explicitly mention colors, typography, effects, and semantic <> structure.",
    "Do not suggest bypassing protections or copying long copyrighted text verbatim.",
    "Return strict JSON with keys: prompt, summary, designBlueprint, starterHtmlCss.",
  ].join(" ");
}

function buildUserPayload(pack: DesignDnaPack) {
  return {
    targetUrl: pack.meta.url,
    viewport: pack.meta.viewport,
    colors: pack.design_tokens.colors.slice(0, 8),
    typography: pack.design_tokens.typography,
    spacing: pack.design_tokens.spacing.slice(0, 8),
    sections: pack.layout_map.sections.slice(0, 12),
    components: pack.components.slice(0, 12),
    contentSummary: pack.content_summary,
    vision: pack.vision_summary,
    constraints: pack.recreation_guidance.constraints,
  };
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM did not return JSON");
  }
  return text.slice(start, end + 1);
}

export async function enhanceWithOpenAi(pack: DesignDnaPack): Promise<PrototypeResult> {
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      prompt:
        "LLM_API_KEY is missing. Add it to .env.local to enable AI-enhanced output.",
      summary:
        "AI enhancement unavailable because LLM_API_KEY (or OPENAI_API_KEY) is not configured.",
    };
  }

  const baseUrl = (process.env.LLM_API_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const includeStarterHtml =
    (process.env.LLM_INCLUDE_STARTER_HTML ?? "false").toLowerCase() === "true";
  const maxTokens = includeStarterHtml ? 1800 : 900;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40_000);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      max_tokens: maxTokens,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(includeStarterHtml),
        },
        {
          role: "user",
          content: [
            "Return only JSON with keys: prompt, summary, designBlueprint, starterHtmlCss.",
            JSON.stringify({
              ...buildUserPayload(pack),
              request: {
                includeStarterHtml,
              },
            }),
          ].join("\n\n"),
        },
      ],
      chat_template_kwargs: {
        thinking:
          (process.env.LLM_CHAT_TEMPLATE_THINKING ?? "false").toLowerCase() ===
          "true",
      },
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        reasoning_content?: string | null;
      };
    }>;
  };

  const content =
    data.choices?.[0]?.message?.content ??
    data.choices?.[0]?.message?.reasoning_content;
  if (!content) {
    throw new Error("LLM returned no content");
  }

  const parsed = JSON.parse(extractJsonObject(content)) as PrototypeResult;
  if (!parsed.designBlueprint) {
    parsed.designBlueprint = {
      themeReference: "Based on the source site's visual theme and structure.",
      colors: [],
      typography: [],
      effects: [],
      htmlStructure: [],
    };
  }
  if (typeof parsed.starterHtmlCss !== "string") {
    parsed.starterHtmlCss = "";
  }
  return parsed;
}
