import type {
  ComponentRecipe,
  ShadowToken,
  StyleSpec,
} from "@/lib/types";
import type {
  CapturedNode,
  ExtractionSnapshot,
  Weighted,
} from "@/lib/extractor/extraction-types";
import {
  clusterColors,
  clusterNumberScale,
  rankWeightedStrings,
} from "@/lib/extractor/style-cluster";
import {
  normalizeColor,
  normalizeFontFamily,
  normalizeFontWeight,
  normalizeShadow,
  parsePxList,
  parsePxValue,
  relativeLuminance,
  saturation,
  toHexWithAlpha,
} from "@/lib/extractor/style-normalize";

function round(value: number, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function numericOrNull(input: string): number | null {
  const value = Number.parseFloat(input.trim());
  return Number.isFinite(value) ? value : null;
}

function normalizeEffect(value: string): string | null {
  const normalized = value.trim();
  if (!normalized || normalized === "none" || normalized === "normal") {
    return null;
  }
  return normalized;
}

function roleBoost(node: CapturedNode): number {
  const tag = node.tag.toLowerCase();
  const role = node.role.toLowerCase();

  if (["h1", "h2", "h3"].includes(tag)) return 1.5;
  if (tag === "button" || role === "button") return 1.4;
  if (tag === "nav" || tag === "footer" || role === "navigation") return 1.1;
  return 1;
}

export function computeNodeWeight(
  node: CapturedNode,
  viewport: { width: number; height: number },
): number {
  const area = Math.max(1, node.width * node.height);
  const areaWeight = Math.sqrt(area);
  const aboveFoldBoost = node.y < viewport.height ? 1.25 : 1;
  return areaWeight * aboveFoldBoost * roleBoost(node);
}

type CollectedCandidates = {
  colors: Array<Weighted<string>>;
  fontFamilies: Array<Weighted<string>>;
  fontSizes: Array<Weighted<number>>;
  fontWeights: Array<Weighted<number>>;
  lineHeightsPx: Array<Weighted<number>>;
  lineHeightsUnitless: Array<Weighted<number>>;
  letterSpacing: Array<Weighted<number>>;
  spacing: Array<Weighted<number>>;
  radii: Array<Weighted<number>>;
  shadows: Array<Weighted<string>>;
  shadowObjects: Array<Weighted<ShadowToken>>;
  effects: Array<Weighted<string>>;
  widths: Array<Weighted<number>>;
  maxWidths: Array<Weighted<number>>;
  gridPatterns: Array<Weighted<string>>;
};

function collectCandidates(snapshot: ExtractionSnapshot): CollectedCandidates {
  const prominentSelectors = new Set(snapshot.prominentNodes.map((node) => node.selector));

  const colors: Array<Weighted<string>> = [];
  const fontFamilies: Array<Weighted<string>> = [];
  const fontSizes: Array<Weighted<number>> = [];
  const fontWeights: Array<Weighted<number>> = [];
  const lineHeightsPx: Array<Weighted<number>> = [];
  const lineHeightsUnitless: Array<Weighted<number>> = [];
  const letterSpacing: Array<Weighted<number>> = [];
  const spacing: Array<Weighted<number>> = [];
  const radii: Array<Weighted<number>> = [];
  const shadows: Array<Weighted<string>> = [];
  const shadowObjects: Array<Weighted<ShadowToken>> = [];
  const effects: Array<Weighted<string>> = [];
  const widths: Array<Weighted<number>> = [];
  const maxWidths: Array<Weighted<number>> = [];
  const gridPatterns: Array<Weighted<string>> = [];

  const colorKeys = [
    "color",
    "backgroundColor",
    "borderColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
  ];

  const spacingKeys = ["margin", "padding", "gap", "rowGap", "columnGap"];
  const radiusKeys = [
    "borderRadius",
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomLeftRadius",
    "borderBottomRightRadius",
  ];

  for (const node of snapshot.nodes) {
    let weight = computeNodeWeight(node, snapshot.viewport);
    if (prominentSelectors.has(node.selector)) {
      weight *= 1.35;
    }

    for (const key of colorKeys) {
      const color = normalizeColor(node.styles[key] ?? "");
      if (!color) continue;
      colors.push({ value: toHexWithAlpha(color), weight, source: key });
    }

    const family = normalizeFontFamily(node.styles.fontFamily ?? "");
    if (family) {
      fontFamilies.push({ value: family, weight });
    }

    const fontSize = parsePxValue(node.styles.fontSize ?? "");
    if (fontSize !== null) {
      fontSizes.push({ value: fontSize, weight });
    }

    const fontWeight = normalizeFontWeight(node.styles.fontWeight ?? "");
    if (fontWeight !== null) {
      fontWeights.push({ value: fontWeight, weight });
    }

    const lineHeightRaw = (node.styles.lineHeight ?? "").trim();
    if (lineHeightRaw.endsWith("px")) {
      const px = parsePxValue(lineHeightRaw);
      if (px !== null) {
        lineHeightsPx.push({ value: px, weight });
      }
    } else {
      const unitless = numericOrNull(lineHeightRaw);
      if (unitless !== null && unitless > 0) {
        lineHeightsUnitless.push({ value: unitless, weight });
      }
    }

    const letter = parsePxValue(node.styles.letterSpacing ?? "");
    if (letter !== null) {
      letterSpacing.push({ value: letter, weight });
    }

    for (const key of spacingKeys) {
      const values = parsePxList(node.styles[key] ?? "");
      for (const value of values) {
        spacing.push({ value, weight, source: key });
      }
    }

    for (const key of radiusKeys) {
      const values = parsePxList(node.styles[key] ?? "");
      for (const value of values) {
        radii.push({ value, weight, source: key });
      }
    }

    const shadowRaw = normalizeEffect(node.styles.boxShadow ?? "");
    if (shadowRaw) {
      shadows.push({ value: shadowRaw, weight });
      const parsed = normalizeShadow(shadowRaw);
      if (parsed.length) {
        shadowObjects.push({ value: parsed[0], weight });
      }
    }

    for (const effectRaw of [
      node.styles.filter,
      node.styles.backdropFilter,
      node.styles.backgroundImage,
    ]) {
      const effect = normalizeEffect(effectRaw ?? "");
      if (!effect) continue;
      effects.push({ value: effect, weight });
    }

    const width = parsePxValue(node.styles.width ?? "");
    if (width !== null && width > 40) {
      widths.push({ value: width, weight });
    }

    const maxWidth = parsePxValue(node.styles.maxWidth ?? "");
    if (maxWidth !== null && maxWidth > 40) {
      maxWidths.push({ value: maxWidth, weight });
    }

    const display = (node.styles.display ?? "").toLowerCase();
    if (display === "grid") {
      const columns = (node.styles.gridTemplateColumns ?? "").trim();
      if (columns && columns !== "none") {
        gridPatterns.push({ value: `grid:${columns}`, weight });
      }
    }

    if (display.includes("flex")) {
      const direction = (node.styles.flexDirection ?? "row").trim();
      gridPatterns.push({ value: `flex:${direction}`, weight: weight * 0.7 });
    }
  }

  return {
    colors,
    fontFamilies,
    fontSizes,
    fontWeights,
    lineHeightsPx,
    lineHeightsUnitless,
    letterSpacing,
    spacing,
    radii,
    shadows,
    shadowObjects,
    effects,
    widths,
    maxWidths,
    gridPatterns,
  };
}

function sectionBoundsContainsNode(
  node: CapturedNode,
  section: ExtractionSnapshot["sections"][number],
) {
  return (
    node.x >= section.x &&
    node.y >= section.y &&
    node.x <= section.x + section.width &&
    node.y <= section.y + section.height
  );
}

function inferSectionLabel(
  section: ExtractionSnapshot["sections"][number],
  snapshot: ExtractionSnapshot,
): string {
  const tag = section.tag.toLowerCase();
  if (tag === "header" || tag === "nav") return "Header / Nav";
  if (tag === "footer") return "Footer";

  const nodesInSection = snapshot.nodes.filter((node) =>
    sectionBoundsContainsNode(node, section),
  );

  if (
    section.y < snapshot.viewport.height &&
    nodesInSection.some((node) => node.tag === "h1")
  ) {
    return "Hero";
  }

  const sectionText = nodesInSection
    .map((node) => node.text)
    .join(" ")
    .toLowerCase();
  if (/(pricing|plan|\$\d|per month|per year)/i.test(sectionText)) {
    return "Pricing";
  }

  const cardLikeCount = nodesInSection.filter((node) => {
    const hasBackground = Boolean(normalizeColor(node.styles.backgroundColor ?? ""));
    const hasRadius = parsePxList(node.styles.borderRadius ?? "").some((value) => value > 0);
    const hasShadow = (node.styles.boxShadow ?? "").trim() !== "none";
    return node.width > 120 && node.height > 80 && hasBackground && (hasRadius || hasShadow);
  }).length;

  if (cardLikeCount >= 3) {
    return "Features";
  }

  if (tag === "main") return "Main";
  if (tag === "section") return "Section";
  if (tag === "article") return "Article";

  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

function pickByWeight<T>(items: Array<Weighted<T>>) {
  return items.slice().sort((a, b) => b.weight - a.weight)[0]?.value;
}

function buildComponentRecipe(
  node: CapturedNode,
  type: string,
): ComponentRecipe {
  const styles = node.styles;
  const padding = parsePxList(styles.padding ?? "");
  const radiusValues = [
    ...parsePxList(styles.borderTopLeftRadius ?? ""),
    ...parsePxList(styles.borderTopRightRadius ?? ""),
    ...parsePxList(styles.borderBottomLeftRadius ?? ""),
    ...parsePxList(styles.borderBottomRightRadius ?? ""),
    ...parsePxList(styles.borderRadius ?? ""),
  ];
  const radius =
    radiusValues.length > 0
      ? round(radiusValues.reduce((sum, value) => sum + value, 0) / radiusValues.length)
      : undefined;

  const textColor = normalizeColor(styles.color ?? "");
  const backgroundColor = normalizeColor(styles.backgroundColor ?? "");
  const borderColor =
    normalizeColor(styles.borderTopColor ?? "") ??
    normalizeColor(styles.borderColor ?? "");
  const borderWidth =
    parsePxValue(styles.borderTopWidth ?? "") ??
    parsePxList(styles.border ?? "")[0] ??
    undefined;
  const fontFamily = normalizeFontFamily(styles.fontFamily ?? "") ?? undefined;
  const fontSize = parsePxValue(styles.fontSize ?? "") ?? undefined;
  const fontWeight = normalizeFontWeight(styles.fontWeight ?? "") ?? undefined;
  const shadow = normalizeShadow(styles.boxShadow ?? "")[0];

  const paddingY =
    padding.length === 1
      ? padding[0]
      : padding.length >= 2
        ? padding[0]
        : undefined;

  const paddingX =
    padding.length === 1
      ? padding[0]
      : padding.length >= 2
        ? padding[1]
        : undefined;

  const notes: string[] = [];
  const textTransform = (styles.textTransform ?? "").trim();
  if (textTransform && textTransform !== "none") {
    notes.push(`text-transform: ${textTransform}`);
  }

  const textDecoration = (styles.textDecorationLine ?? "").trim();
  if (textDecoration && textDecoration !== "none") {
    notes.push(`text-decoration: ${textDecoration}`);
  }

  return {
    selector: node.selector,
    type,
    text_preview: node.text || undefined,
    background_color: backgroundColor ? toHexWithAlpha(backgroundColor) : undefined,
    text_color: textColor ? toHexWithAlpha(textColor) : undefined,
    border_color: borderColor ? toHexWithAlpha(borderColor) : undefined,
    border_width_px: borderWidth !== undefined ? round(borderWidth) : undefined,
    border_style: styles.borderTopStyle || undefined,
    radius_px: radius,
    padding_x_px: paddingX !== undefined ? round(paddingX) : undefined,
    padding_y_px: paddingY !== undefined ? round(paddingY) : undefined,
    font_family: fontFamily,
    font_size_px: fontSize !== undefined ? round(fontSize) : undefined,
    font_weight: fontWeight,
    shadow,
    notes: notes.length ? notes : undefined,
  };
}

function pickProminentNode(
  snapshot: ExtractionSnapshot,
  predicate: (node: CapturedNode) => boolean,
): CapturedNode | undefined {
  return snapshot.nodes
    .filter(predicate)
    .sort((a, b) => {
      const weightA = computeNodeWeight(a, snapshot.viewport);
      const weightB = computeNodeWeight(b, snapshot.viewport);
      return weightB - weightA;
    })[0];
}

function buildComponentRecipes(snapshot: ExtractionSnapshot): StyleSpec["components"] {
  const primaryButtonNode = pickProminentNode(snapshot, (node) => {
    const isButton =
      node.tag === "button" ||
      node.role === "button" ||
      /\b(btn|button|cta)\b/i.test(node.selector);
    if (!isButton) return false;

    const background = normalizeColor(node.styles.backgroundColor ?? "");
    return Boolean(background);
  });

  const secondaryButtonNode = snapshot.nodes
    .filter((node) => {
      const isButton =
        node.tag === "button" || node.role === "button" || /\b(btn|button)\b/i.test(node.selector);
      if (!isButton) return false;

      const background = normalizeColor(node.styles.backgroundColor ?? "");
      const border = normalizeColor(node.styles.borderColor ?? "");
      return !background && Boolean(border);
    })
    .sort((a, b) => computeNodeWeight(b, snapshot.viewport) - computeNodeWeight(a, snapshot.viewport))[0];

  const cardNode = pickProminentNode(snapshot, (node) => {
    if (node.width < 140 || node.height < 100) return false;
    const hasBackground = Boolean(normalizeColor(node.styles.backgroundColor ?? ""));
    const hasRadius = parsePxList(node.styles.borderRadius ?? "").some((value) => value > 2);
    const hasShadow = (node.styles.boxShadow ?? "").trim() !== "none";
    return hasBackground && (hasRadius || hasShadow);
  });

  const inputNode = pickProminentNode(snapshot, (node) =>
    ["input", "textarea", "select"].includes(node.tag),
  );

  const linkNode = pickProminentNode(snapshot, (node) => node.tag === "a" && Boolean(node.text));

  return {
    primaryButton: primaryButtonNode
      ? buildComponentRecipe(primaryButtonNode, "primary_button")
      : undefined,
    secondaryButton: secondaryButtonNode
      ? buildComponentRecipe(secondaryButtonNode, "secondary_button")
      : undefined,
    card: cardNode ? buildComponentRecipe(cardNode, "card") : undefined,
    input: inputNode ? buildComponentRecipe(inputNode, "input") : undefined,
    link: linkNode ? buildComponentRecipe(linkNode, "link") : undefined,
  };
}

function pickPaletteRoles(colors: Array<{ value: string; weight: number }>) {
  if (!colors.length) {
    return {};
  }

  const byLuminance = colors
    .slice()
    .sort((a, b) => relativeLuminance(a.value) - relativeLuminance(b.value));

  const bySaturation = colors
    .slice()
    .sort((a, b) => saturation(b.value) - saturation(a.value));

  const textPrimary = byLuminance[0]?.value;
  const textSecondary = byLuminance[1]?.value;
  const background = byLuminance[byLuminance.length - 1]?.value;
  const surface = byLuminance[byLuminance.length - 2]?.value;

  const saturatedCandidates = bySaturation.filter((color) => {
    return color.value !== background && color.value !== textPrimary;
  });

  const primary = saturatedCandidates[0]?.value ?? colors[0]?.value;
  const secondary = saturatedCandidates[1]?.value;
  const accent = saturatedCandidates[2]?.value;

  const border = colors
    .slice()
    .sort((a, b) => {
      const aDistance = Math.abs(relativeLuminance(a.value) - 0.7);
      const bDistance = Math.abs(relativeLuminance(b.value) - 0.7);
      return aDistance - bDistance;
    })[0]?.value;

  return {
    primary,
    secondary,
    background,
    surface,
    textPrimary,
    textSecondary,
    border,
    accent,
  };
}

function roleHintFromRank(indexFromLargest: number): string {
  if (indexFromLargest === 0) return "h1";
  if (indexFromLargest === 1) return "h2";
  if (indexFromLargest === 2) return "h3";
  if (indexFromLargest === 3) return "body-large";
  if (indexFromLargest === 4) return "body";
  return "caption";
}

function sectionSpacing(snapshot: ExtractionSnapshot) {
  if (snapshot.sections.length < 2) {
    return [];
  }

  const sorted = snapshot.sections.slice().sort((a, b) => a.y - b.y);
  const values: number[] = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const currentBottom = sorted[i].y + sorted[i].height;
    const gap = Math.round(sorted[i + 1].y - currentBottom);
    if (gap > 0 && gap <= 320) {
      values.push(gap);
    }
  }

  return Array.from(new Set(values)).sort((a, b) => a - b).slice(0, 8);
}

function selectContainerWidth(candidates: CollectedCandidates, viewportWidth: number) {
  const merged = [...candidates.maxWidths, ...candidates.widths]
    .filter((item) => item.value > 280)
    .filter((item) => item.value <= viewportWidth + 200);

  const clustered = clusterNumberScale(merged, {
    tolerance: 8,
    sort: "weight",
    limit: 6,
  });

  const realistic = clustered.filter((item) => item.value < viewportWidth * 1.05);
  return realistic[0]?.value;
}

function buildGridPatterns(candidates: CollectedCandidates) {
  return rankWeightedStrings(candidates.gridPatterns, { limit: 6 }).map(
    (item) => item.value,
  );
}

function usageHintForColor(
  hex: string,
  roles: StyleSpec["palette"]["roles"],
): string {
  const roleEntries = Object.entries(roles).filter(([, value]) => value === hex);
  if (roleEntries.length) {
    return roleEntries
      .map(([key]) => key)
      .join(", ");
  }

  const luma = relativeLuminance(hex);
  if (luma > 0.9) return "background";
  if (luma < 0.15) return "text";
  return "accent";
}

export function buildStyleSpec(input: {
  url: string;
  snapshot: ExtractionSnapshot;
  dominantColors: string[];
}): StyleSpec {
  const { snapshot } = input;
  const candidates = collectCandidates(snapshot);

  const paletteRaw = clusterColors(candidates.colors, { distance: 12, limit: 12 });
  const paletteRoles = pickPaletteRoles(paletteRaw);
  const palette = paletteRaw.map((color) => ({
    hex: color.value,
    usageHint: usageHintForColor(color.value, paletteRoles),
    weight: round(color.weight),
  }));

  const typeScaleAscending = clusterNumberScale(candidates.fontSizes, {
    tolerance: 1,
    sort: "asc",
    limit: 10,
  });

  const sortedByLargest = typeScaleAscending.slice().sort((a, b) => b.value - a.value);
  const roleHints = new Map<number, string>();
  sortedByLargest.forEach((item, index) => {
    roleHints.set(item.value, roleHintFromRank(index));
  });

  const typographyScale = typeScaleAscending
    .map((item) => ({
      px: item.value,
      roleHint: roleHints.get(item.value) ?? "body",
      weight: round(item.weight),
    }))
    .sort((a, b) => b.px - a.px);

  const fontFamilyRanked = rankWeightedStrings(candidates.fontFamilies, { limit: 8 });
  const fontWeightScale = clusterNumberScale(candidates.fontWeights, {
    tolerance: 50,
    sort: "asc",
  }).map((item) => item.value);

  const lineHeights = [
    ...clusterNumberScale(candidates.lineHeightsPx, {
      tolerance: 1,
      sort: "asc",
      limit: 8,
    }).map((item) => ({ value: item.value, unit: "px" as const })),
    ...clusterNumberScale(candidates.lineHeightsUnitless, {
      tolerance: 0.05,
      sort: "asc",
      limit: 6,
    }).map((item) => ({ value: round(item.value), unit: "number" as const })),
  ];

  const letterSpacing = clusterNumberScale(candidates.letterSpacing, {
    tolerance: 0.5,
    sort: "asc",
    limit: 6,
  }).map((item) => ({ px: item.value, weight: round(item.weight) }));

  const spacingScale = clusterNumberScale(candidates.spacing, {
    tolerance: 1,
    sort: "asc",
    limit: 16,
  });

  const radiusScale = clusterNumberScale(candidates.radii, {
    tolerance: 1,
    sort: "asc",
    limit: 12,
  });

  const shadowScale = rankWeightedStrings(candidates.shadows, { limit: 8 });
  const effects = rankWeightedStrings(candidates.effects, { limit: 10 });

  const sections = snapshot.sections.map((section) => ({
    label: inferSectionLabel(section, snapshot),
    selector: section.selector,
    bounds: {
      x: section.x,
      y: section.y,
      width: section.width,
      height: section.height,
    },
  }));

  const styleSpec: StyleSpec = {
    url: input.url,
    viewport: snapshot.viewport,
    palette: {
      colors: palette,
      roles: paletteRoles,
    },
    typography: {
      primaryFamily: fontFamilyRanked[0]?.value,
      secondaryFamily: fontFamilyRanked[1]?.value,
      scale: typographyScale,
      weights: fontWeightScale,
      lineHeights,
      letterSpacing: letterSpacing.length ? letterSpacing : undefined,
    },
    tokens: {
      spacingPx: spacingScale.map((item) => ({
        value: item.value,
        weight: round(item.weight),
      })),
      radiusPx: radiusScale.map((item) => ({
        value: item.value,
        weight: round(item.weight),
      })),
      shadows: shadowScale,
      effects,
    },
    layout: {
      containerWidth: selectContainerWidth(candidates, snapshot.viewport.width),
      sectionVerticalSpacing: sectionSpacing(snapshot),
      gridPatterns: buildGridPatterns(candidates),
    },
    components: buildComponentRecipes(snapshot),
    sections,
    cssVars: Object.keys(snapshot.rootCssVars).length ? snapshot.rootCssVars : undefined,
    vision: {
      dominantColors: input.dominantColors,
      notes: [],
    },
  };

  const bestShadow = pickByWeight(candidates.shadowObjects);
  if (bestShadow && styleSpec.components.card && !styleSpec.components.card.shadow) {
    styleSpec.components.card.shadow = bestShadow;
  }

  styleSpec.vision = {
    dominantColors: input.dominantColors,
    notes: [
      `Captured ${snapshot.nodes.length} visible nodes (${snapshot.prominentNodes.length} prominent).`,
      `Detected ${sections.length} structural sections.`,
    ],
  };

  return styleSpec;
}
