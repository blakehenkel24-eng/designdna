import { compileStitchPrompt } from "@/lib/compile-stitch";
import type { DesignDnaPack } from "@/lib/types";

function topValues(values: Array<{ value: string; count: number }>, limit = 8) {
  return values
    .slice(0, limit)
    .map((item) => `${item.value} (${item.count})`)
    .join(", ");
}

function buildLegacyPrompt(pack: DesignDnaPack) {
  const sections = pack.layout_map.sections
    .slice(0, 12)
    .map((section, index) => {
      return `${index + 1}. ${section.role} ${section.selector} ${Math.round(section.bounds.width)}x${Math.round(section.bounds.height)}`;
    })
    .join("\n");

  return [
    "Create a semantic HTML + CSS recreation based on the source site's theme.",
    `Target URL: ${pack.meta.url}`,
    `Viewport: ${pack.meta.viewport.width}x${pack.meta.viewport.height}`,
    `Colors: ${topValues(pack.design_tokens.colors)}`,
    `Typography families: ${topValues(pack.design_tokens.typography.families)}`,
    `Typography sizes: ${topValues(pack.design_tokens.typography.sizes)}`,
    `Spacing scale: ${topValues(pack.design_tokens.spacing)}`,
    "Sections:",
    sections || "No sections found.",
    "Compliance: Based on the source site's theme; do not copy proprietary branding verbatim.",
  ].join("\n");
}

export function buildRecreationPrompt(pack: DesignDnaPack) {
  if (pack.style_spec) {
    return compileStitchPrompt(pack.style_spec);
  }

  return buildLegacyPrompt(pack);
}
