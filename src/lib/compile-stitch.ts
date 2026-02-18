import type { ComponentRecipe, StyleSpec } from "@/lib/types";

function formatNumberList(values: number[]) {
  if (!values.length) return "n/a";
  return values.map((value) => `${value}px`).join(", ");
}

function formatShadow(shadow: ComponentRecipe["shadow"]) {
  if (!shadow) return "none";
  const spread = shadow.spread !== undefined ? ` ${shadow.spread}px` : "";
  const inset = shadow.inset ? " inset" : "";
  return `${shadow.x}px ${shadow.y}px ${shadow.blur}px${spread} ${shadow.color}${inset}`;
}

function formatRecipe(name: string, recipe?: ComponentRecipe) {
  if (!recipe) {
    return `- ${name}: not confidently detected.`;
  }

  const lines = [
    `- ${name}: selector ${recipe.selector}`,
    `  - colors: bg ${recipe.background_color ?? "transparent"}, text ${recipe.text_color ?? "inherit"}, border ${recipe.border_color ?? "none"}`,
    `  - shape: radius ${recipe.radius_px ?? 0}px, border ${recipe.border_width_px ?? 0}px ${recipe.border_style ?? "solid"}`,
    `  - spacing: padding-y ${recipe.padding_y_px ?? 0}px, padding-x ${recipe.padding_x_px ?? 0}px`,
    `  - type: ${recipe.font_family ?? "inherit"} ${recipe.font_size_px ?? "inherit"}px / weight ${recipe.font_weight ?? "inherit"}`,
    `  - shadow: ${formatShadow(recipe.shadow)}`,
  ];

  if (recipe.notes?.length) {
    lines.push(`  - notes: ${recipe.notes.join("; ")}`);
  }

  return lines.join("\n");
}

function inferVibe(styleSpec: StyleSpec) {
  const adjectives: string[] = [];
  const primary = styleSpec.palette.roles.primary;
  const bg = styleSpec.palette.roles.background;

  if (primary?.startsWith("#")) {
    const brightness = Number.parseInt(primary.slice(1, 3), 16);
    adjectives.push(brightness > 160 ? "bright" : "grounded");
  }

  if (bg?.startsWith("#f") || bg?.startsWith("#e")) {
    adjectives.push("airy");
  } else if (bg) {
    adjectives.push("high-contrast");
  }

  if ((styleSpec.tokens.shadows[0]?.value ?? "").includes("blur")) {
    adjectives.push("soft");
  }

  if (styleSpec.typography.primaryFamily) {
    const family = styleSpec.typography.primaryFamily.toLowerCase();
    if (family.includes("serif")) {
      adjectives.push("editorial");
    } else {
      adjectives.push("modern");
    }
  }

  if (!adjectives.length) {
    adjectives.push("clean", "modern");
  }

  return Array.from(new Set(adjectives)).slice(0, 4);
}

function promptSectionList(styleSpec: StyleSpec) {
  if (!styleSpec.sections.length) return "- Single-page layout with one main section.";

  return styleSpec.sections
    .map((section, index) => {
      const dims = `${Math.round(section.bounds.width)}x${Math.round(section.bounds.height)}`;
      return `${index + 1}. ${section.label} (${section.selector}) ${dims}`;
    })
    .join("\n");
}

function topScale(values: Array<{ value: number; weight: number }>, limit = 8) {
  return values
    .slice(0, limit)
    .map((item) => `${item.value}px`)
    .join(", ");
}

export function compileStitchPrompt(styleSpec: StyleSpec): string {
  const paletteRoles = styleSpec.palette.roles;
  const typeScale = styleSpec.typography.scale
    .map((item) => `${item.roleHint}:${item.px}px`) 
    .join(", ");

  return [
    "Goal:",
    `Create a single-page web interface based on the source site's theme from ${styleSpec.url}, with semantic HTML and clean CSS output suitable for Stitch generation.`,
    "",
    "Vibe:",
    inferVibe(styleSpec).join(", "),
    "",
    "Page structure (preserve order and hierarchy):",
    promptSectionList(styleSpec),
    "",
    "Layout rules:",
    `- Container width: ${styleSpec.layout.containerWidth ? `${styleSpec.layout.containerWidth}px` : "auto (fit source proportions)"}`,
    `- Section vertical spacing scale: ${formatNumberList(styleSpec.layout.sectionVerticalSpacing ?? [])}`,
    `- Grid and alignment patterns: ${(styleSpec.layout.gridPatterns ?? []).join(", ") || "Use source-like grid/flex grouping"}`,
    "- Preserve relative whitespace and major block proportions from top to bottom.",
    "",
    "Design constraints:",
    `- Palette roles: primary ${paletteRoles.primary ?? "n/a"}, secondary ${paletteRoles.secondary ?? "n/a"}, background ${paletteRoles.background ?? "n/a"}, surface ${paletteRoles.surface ?? "n/a"}, text-primary ${paletteRoles.textPrimary ?? "n/a"}, text-secondary ${paletteRoles.textSecondary ?? "n/a"}, border ${paletteRoles.border ?? "n/a"}, accent ${paletteRoles.accent ?? "n/a"}.`,
    `- Palette shortlist: ${styleSpec.palette.colors.map((item) => item.hex).join(", ") || "n/a"}`,
    `- Typography families: primary ${styleSpec.typography.primaryFamily ?? "n/a"}, secondary ${styleSpec.typography.secondaryFamily ?? "n/a"}`,
    `- Typography scale: ${typeScale || "n/a"}`,
    `- Typography weights: ${styleSpec.typography.weights.join(", ") || "n/a"}`,
    `- Spacing scale: ${topScale(styleSpec.tokens.spacingPx) || "n/a"}`,
    `- Radius scale: ${topScale(styleSpec.tokens.radiusPx) || "n/a"}`,
    `- Shadows/effects: ${styleSpec.tokens.shadows.map((item) => item.value).join(" | ") || "none"}`,
    "",
    "Component recipes (follow these values where available):",
    formatRecipe("Primary button", styleSpec.components.primaryButton),
    formatRecipe("Secondary button", styleSpec.components.secondaryButton),
    formatRecipe("Card", styleSpec.components.card),
    formatRecipe("Input", styleSpec.components.input),
    formatRecipe("Link", styleSpec.components.link),
    "",
    "Responsive rules:",
    "- At mobile widths, stack multi-column groups into single-column flow while preserving spacing hierarchy.",
    "- Keep tap targets >= 40px height and maintain button/input visual style.",
    "- Keep nav readable on small screens (stack or collapse layout, but keep hierarchy).",
    "",
    "Output requirements:",
    "- Return one HTML file with semantic structure and one CSS block.",
    "- Keep behavior static (no JavaScript interactions required).",
    "",
    "Compliance:",
    "Based on the source site's theme; do not copy proprietary branding verbatim.",
  ].join("\n");
}
