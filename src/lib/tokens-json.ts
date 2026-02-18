import type { StyleSpec } from "@/lib/types";
import type { SemanticTokensJson } from "@/lib/schema/styleSpec.schema";

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value))));
}

export function buildSemanticTokensJson(input: {
  styleSpec: StyleSpec;
  designPrompt: string;
}): SemanticTokensJson {
  const { styleSpec, designPrompt } = input;

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    source_url: styleSpec.url,
    design_prompt: designPrompt,
    tokens: {
      color: {
        palette: styleSpec.palette.colors.map((item) => item.hex),
        roles: {
          ...styleSpec.palette.roles,
        },
      },
      typography: {
        families: [
          styleSpec.typography.primaryFamily,
          styleSpec.typography.secondaryFamily,
        ].filter((value): value is string => Boolean(value)),
        scale: uniqueNumbers(styleSpec.typography.scale.map((item) => item.px)).sort(
          (a, b) => a - b,
        ),
        weights: uniqueNumbers(styleSpec.typography.weights).sort((a, b) => a - b),
        line_heights: uniqueNumbers(
          styleSpec.typography.lineHeights.map((item) => item.value),
        ).sort((a, b) => a - b),
      },
      spacing: uniqueNumbers(styleSpec.tokens.spacingPx.map((item) => item.value)).sort(
        (a, b) => a - b,
      ),
      radius: uniqueNumbers(styleSpec.tokens.radiusPx.map((item) => item.value)).sort(
        (a, b) => a - b,
      ),
      shadow: styleSpec.tokens.shadows.map((item) => item.value),
      effects: styleSpec.tokens.effects.map((item) => item.value),
    },
    components: {
      primary_button: styleSpec.components.primaryButton,
      secondary_button: styleSpec.components.secondaryButton,
      card: styleSpec.components.card,
      input: styleSpec.components.input,
      link: styleSpec.components.link,
    },
    sections: styleSpec.sections.map((section) => ({
      label: section.label,
      selector: section.selector,
      width: Math.round(section.bounds.width),
      height: Math.round(section.bounds.height),
    })),
    notes: [
      "Generated from deterministic extraction and normalization pipeline.",
      "Use as a design reference, not a verbatim copy of proprietary branding/content.",
    ],
    assumptions: [
      "Spacing and layout constraints prioritize visible rendered output.",
      "Interactive states are inferred best-effort from computed styles.",
    ],
  };
}
