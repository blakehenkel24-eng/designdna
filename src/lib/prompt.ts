import type { DesignDnaPack } from "@/lib/types";

function topValues(values: Array<{ value: string; count: number }>, limit = 8) {
  return values
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item) => `${item.value} (${item.count})`)
    .join(", ");
}

export function buildRecreationPrompt(pack: DesignDnaPack) {
  const sections = pack.layout_map.sections
    .slice(0, 12)
    .map((section, index) => {
      return `${index + 1}. ${section.role} ${section.selector} ${Math.round(section.bounds.width)}x${Math.round(section.bounds.height)}`;
    })
    .join("\n");

  const components = pack.components
    .slice(0, 12)
    .map((component, index) => {
      return `${index + 1}. ${component.type} ${component.selector} -> ${component.text_preview || "(no text)"}`;
    })
    .join("\n");

  return [
    "You are recreating a web page in semantic HTML + CSS from extracted design DNA.",
    "Output requirements:",
    "- Return one complete HTML document and one CSS block.",
    "- Preserve visual hierarchy, spacing rhythm, and relative proportions.",
    "- Do not include JavaScript behavior beyond static layout.",
    "- Do not copy third-party copyrighted long-form text verbatim.",
    "",
    `Target URL: ${pack.meta.url}`,
    `Viewport: ${pack.meta.viewport.width}x${pack.meta.viewport.height}`,
    `Capture timestamp: ${pack.meta.captured_at}`,
    "",
    "Design tokens:",
    `- Colors: ${topValues(pack.design_tokens.colors)}`,
    `- Font families: ${topValues(pack.design_tokens.typography.families)}`,
    `- Font sizes: ${topValues(pack.design_tokens.typography.sizes)}`,
    `- Font weights: ${topValues(pack.design_tokens.typography.weights)}`,
    `- Spacing: ${topValues(pack.design_tokens.spacing)}`,
    `- Radii: ${topValues(pack.design_tokens.radii)}`,
    `- Shadows: ${topValues(pack.design_tokens.shadows)}`,
    `- Borders: ${topValues(pack.design_tokens.borders)}`,
    "",
    "Layout map:",
    sections || "No sections found.",
    "",
    "Reusable component candidates:",
    components || "No components found.",
    "",
    "Vision summary:",
    `- Dominant colors from screenshot: ${pack.vision_summary.dominant_colors.join(", ") || "n/a"}`,
    ...pack.vision_summary.notes.map((note) => `- ${note}`),
    "",
    "Constraints:",
    ...pack.recreation_guidance.constraints.map((constraint) => `- ${constraint}`),
    "",
    "Now produce the recreated HTML and CSS.",
  ].join("\n");
}
