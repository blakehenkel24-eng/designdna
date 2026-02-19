import { chromium, type Page } from "playwright";

import { ExtractionError } from "@/lib/errors";
import { detectLoginWall } from "@/lib/extractor/login-wall";
import type { ExtractionSnapshot } from "@/lib/extractor/extraction-types";
import { buildStyleSpec } from "@/lib/extractor/style-spec";
import { styleSpecSchema } from "@/lib/schema/styleSpec.schema";
import {
  normalizeColor,
  normalizeFontFamily,
  normalizeFontWeight,
  parsePxList,
  parsePxValue,
  toHexWithAlpha,
} from "@/lib/extractor/style-normalize";
import {
  buildVisionNotes,
  extractDominantColorsFromPng,
} from "@/lib/extractor/vision";
import type { DesignDnaPack, DesignTokenFrequency } from "@/lib/types";

const NAVIGATION_TIMEOUT_MS = 35_000;
const NAVIGATION_FALLBACK_TIMEOUT_MS = 15_000;
const NETWORK_IDLE_WAIT_MS = 8_000;
const CAPTURE_SETTLE_MS = 1_200;
const SCREENSHOT_TIMEOUT_MS = 20_000;
const SCREENSHOT_FALLBACK_TIMEOUT_MS = 10_000;

const FAST_NAVIGATION_TIMEOUT_MS = 20_000;
const FAST_NAVIGATION_FALLBACK_TIMEOUT_MS = 8_000;
const FAST_NETWORK_IDLE_WAIT_MS = 2_500;
const FAST_CAPTURE_SETTLE_MS = 500;
const FAST_SCREENSHOT_TIMEOUT_MS = 8_000;
const FAST_SCREENSHOT_FALLBACK_TIMEOUT_MS = 4_000;

type CaptureTimeoutConfig = {
  navTimeoutMs: number;
  navFallbackTimeoutMs: number;
  networkIdleWaitMs: number;
  captureSettleMs: number;
  screenshotTimeoutMs: number;
  screenshotFallbackTimeoutMs: number;
};

export type CaptureTiming = {
  mode: "legacy" | "fast";
  backstop_used: boolean;
  backstop_reason: "low_completeness" | "attempt_failed" | null;
  used_config: {
    nav_timeout_ms: number;
    nav_fallback_timeout_ms: number;
    network_idle_wait_ms: number;
    capture_settle_ms: number;
    screenshot_timeout_ms: number;
    screenshot_fallback_timeout_ms: number;
  };
  phase_ms: {
    navigation_ms: number;
    network_idle_ms: number;
    settle_ms: number;
    snapshot_ms: number;
    screenshot_ms: number;
    total_ms: number;
  };
  snapshot_counts: {
    nodes: number;
    prominent_nodes: number;
    sections: number;
  };
};

function getEnvMs(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function isFastCaptureModeEnabled() {
  return (process.env.ANALYZE_FAST_MODE_ENABLED ?? "false").toLowerCase() === "true";
}

export function getCaptureTimeoutConfig(mode: "legacy" | "fast"): CaptureTimeoutConfig {
  if (mode === "fast") {
    return {
      navTimeoutMs: getEnvMs("ANALYZE_NAV_TIMEOUT_MS", FAST_NAVIGATION_TIMEOUT_MS),
      navFallbackTimeoutMs: getEnvMs(
        "ANALYZE_NAV_FALLBACK_TIMEOUT_MS",
        FAST_NAVIGATION_FALLBACK_TIMEOUT_MS,
      ),
      networkIdleWaitMs: getEnvMs("ANALYZE_NETWORK_IDLE_WAIT_MS", FAST_NETWORK_IDLE_WAIT_MS),
      captureSettleMs: getEnvMs("ANALYZE_CAPTURE_SETTLE_MS", FAST_CAPTURE_SETTLE_MS),
      screenshotTimeoutMs: getEnvMs("ANALYZE_SCREENSHOT_TIMEOUT_MS", FAST_SCREENSHOT_TIMEOUT_MS),
      screenshotFallbackTimeoutMs: getEnvMs(
        "ANALYZE_SCREENSHOT_FALLBACK_TIMEOUT_MS",
        FAST_SCREENSHOT_FALLBACK_TIMEOUT_MS,
      ),
    };
  }

  return {
    navTimeoutMs: NAVIGATION_TIMEOUT_MS,
    navFallbackTimeoutMs: NAVIGATION_FALLBACK_TIMEOUT_MS,
    networkIdleWaitMs: NETWORK_IDLE_WAIT_MS,
    captureSettleMs: CAPTURE_SETTLE_MS,
    screenshotTimeoutMs: SCREENSHOT_TIMEOUT_MS,
    screenshotFallbackTimeoutMs: SCREENSHOT_FALLBACK_TIMEOUT_MS,
  };
}

function shouldRetryForCompleteness(snapshot: ExtractionSnapshot) {
  const tooFewProminentNodes = snapshot.prominentNodes.length < 8;
  const tooFewSections = snapshot.sections.length < 3;
  const tooFewNodes = snapshot.nodes.length < 160;
  return tooFewProminentNodes || tooFewSections || tooFewNodes;
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value));
}

function styleSignature(styles: Record<string, string>) {
  const keys = [
    "display",
    "position",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "color",
    "backgroundColor",
    "backgroundImage",
    "padding",
    "margin",
    "borderTopLeftRadius",
    "borderTopWidth",
    "borderTopStyle",
    "borderTopColor",
    "boxShadow",
    "gap",
    "rowGap",
    "columnGap",
    "flexDirection",
    "gridTemplateColumns",
  ];

  return keys
    .map((key) => `${key}:${styles[key] ?? ""}`)
    .filter((entry) => !entry.endsWith(":"))
    .join(";");
}

function countValues(values: string[]): DesignTokenFrequency[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || normalized === "none" || normalized === "normal") {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

function toWeightedFrequencies(
  items: Array<{ value: string; weight: number }>,
  limit = 12,
): DesignTokenFrequency[] {
  return items
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((item) => ({
      value: item.value,
      count: Math.max(1, Math.round(item.weight)),
    }));
}

function buildLegacyTypography(snapshot: ExtractionSnapshot) {
  const families = countValues(
    snapshot.nodes
      .map((node) => normalizeFontFamily(node.styles.fontFamily ?? ""))
      .filter((value): value is string => Boolean(value)),
  );

  const sizes = countValues(
    snapshot.nodes
      .map((node) => parsePxValue(node.styles.fontSize ?? ""))
      .filter((value): value is number => value !== null)
      .map((value) => `${Math.round(value)}px`),
  );

  const weights = countValues(
    snapshot.nodes
      .map((node) => normalizeFontWeight(node.styles.fontWeight ?? ""))
      .filter((value): value is number => value !== null)
      .map((value) => String(value)),
  );

  const lineHeights = countValues(
    snapshot.nodes
      .flatMap((node) => {
        const raw = (node.styles.lineHeight ?? "").trim();
        if (raw.endsWith("px")) {
          const px = parsePxValue(raw);
          return px !== null ? [`${Math.round(px)}px`] : [];
        }
        const numeric = Number.parseFloat(raw);
        if (Number.isFinite(numeric)) {
          return [String(Number(numeric.toFixed(2)))];
        }
        return [];
      }),
  );

  return {
    families,
    sizes,
    weights,
    line_heights: lineHeights,
  };
}

function buildLegacySpacing(snapshot: ExtractionSnapshot) {
  const values = snapshot.nodes.flatMap((node) => {
    const style = node.styles;
    return [
      ...parsePxList(style.margin ?? ""),
      ...parsePxList(style.padding ?? ""),
      ...parsePxList(style.gap ?? ""),
      ...parsePxList(style.rowGap ?? ""),
      ...parsePxList(style.columnGap ?? ""),
    ].map((value) => `${Math.round(value)}px`);
  });

  return countValues(values);
}

function buildLegacyRadii(snapshot: ExtractionSnapshot) {
  const values = snapshot.nodes.flatMap((node) => {
    const style = node.styles;
    return [
      ...parsePxList(style.borderRadius ?? ""),
      ...parsePxList(style.borderTopLeftRadius ?? ""),
      ...parsePxList(style.borderTopRightRadius ?? ""),
      ...parsePxList(style.borderBottomLeftRadius ?? ""),
      ...parsePxList(style.borderBottomRightRadius ?? ""),
    ].map((value) => `${Math.round(value)}px`);
  });

  return countValues(values);
}

function buildLegacyBorders(snapshot: ExtractionSnapshot) {
  const borderValues = snapshot.nodes
    .map((node) => {
      const width = parsePxValue(node.styles.borderTopWidth ?? "") ?? 0;
      const style = (node.styles.borderTopStyle ?? "").trim() || "solid";
      const color = normalizeColor(
        node.styles.borderTopColor ?? node.styles.borderColor ?? "",
      );
      if (!color && width <= 0) {
        return "";
      }

      return `${Math.round(width)}px ${style} ${color ? toHexWithAlpha(color) : "currentColor"}`;
    })
    .filter(Boolean);

  return countValues(borderValues);
}

function buildLegacyColors(snapshot: ExtractionSnapshot) {
  const values = snapshot.nodes.flatMap((node) => {
    const colorKeys = [
      "color",
      "backgroundColor",
      "borderColor",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
    ] as const;

    return colorKeys
      .map((key) => normalizeColor(node.styles[key] ?? ""))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .map((value) => toHexWithAlpha(value));
  });

  return countValues(values);
}

function buildPack(input: {
  url: string;
  snapshot: ExtractionSnapshot;
  dominantColors: string[];
}) {
  const { snapshot, dominantColors } = input;
  const styleSpec = buildStyleSpec({
    url: input.url,
    snapshot,
    dominantColors,
  });
  const styleSpecValidation = styleSpecSchema.safeParse(styleSpec);

  const componentEntries = [
    styleSpec.components.primaryButton,
    styleSpec.components.secondaryButton,
    styleSpec.components.card,
    styleSpec.components.input,
    styleSpec.components.link,
  ].filter((component): component is NonNullable<typeof component> => Boolean(component));

  const fallbackComponents = snapshot.prominentNodes
    .slice(0, 20)
    .map((node, index) => ({
      id: `component_prominent_${index + 1}`,
      selector: node.selector,
      type: node.role || node.tag,
      text_preview: node.text,
      style_signature: styleSignature(node.styles),
    }));

  const pack: DesignDnaPack = {
    meta: {
      url: input.url,
      captured_at: new Date().toISOString(),
      capture_version: "design_dna_pack_v2",
      viewport: snapshot.viewport,
      compliance_flags: {
        robots_allowed: true,
        blocked: false,
      },
    },
    design_tokens: {
      colors: toWeightedFrequencies(
        styleSpec.palette.colors.map((item) => ({ value: item.hex, weight: item.weight })),
      ),
      typography: buildLegacyTypography(snapshot),
      spacing: toWeightedFrequencies(
        styleSpec.tokens.spacingPx.map((item) => ({
          value: `${item.value}px`,
          weight: item.weight,
        })),
      ),
      radii: toWeightedFrequencies(
        styleSpec.tokens.radiusPx.map((item) => ({
          value: `${item.value}px`,
          weight: item.weight,
        })),
      ),
      shadows: toWeightedFrequencies(styleSpec.tokens.shadows),
      borders: buildLegacyBorders(snapshot),
      effects: toWeightedFrequencies(styleSpec.tokens.effects),
    },
    layout_map: {
      sections: styleSpec.sections.map((section, index) => ({
        id: `section_${index + 1}`,
        selector: section.selector,
        role: section.label,
        bounds: {
          x: section.bounds.x,
          y: section.bounds.y,
          width: section.bounds.width,
          height: section.bounds.height,
        },
        children:
          snapshot.sections.find((entry) => entry.selector === section.selector)?.children ?? [],
        responsive_hints: [
          section.bounds.width > snapshot.viewport.width * 0.9
            ? "full-width container"
            : "contained width",
          section.bounds.y < snapshot.viewport.height ? "above fold" : "below fold",
        ],
      })),
    },
    components: [
      ...componentEntries.map((component, index) => ({
        id: `component_recipe_${index + 1}`,
        selector: component.selector,
        type: component.type,
        text_preview: component.text_preview ?? "",
        style_signature: [
          `bg:${component.background_color ?? ""}`,
          `text:${component.text_color ?? ""}`,
          `radius:${component.radius_px ?? ""}`,
          `paddingY:${component.padding_y_px ?? ""}`,
          `paddingX:${component.padding_x_px ?? ""}`,
          `fontSize:${component.font_size_px ?? ""}`,
          `fontWeight:${component.font_weight ?? ""}`,
          `shadow:${component.shadow ? `${component.shadow.x}px ${component.shadow.y}px ${component.shadow.blur}px ${component.shadow.color}` : ""}`,
        ]
          .filter(Boolean)
          .join(";"),
      })),
      ...fallbackComponents,
    ].slice(0, 60),
    assets: snapshot.assets,
    content_summary: {
      title: snapshot.title,
      headings: snapshot.headings,
      buttons: snapshot.buttons,
      nav_items: snapshot.navItems,
    },
    recreation_guidance: {
      objective: "Create a Stitch-ready design spec from extracted layout and style data.",
      constraints: [
        "Preserve section hierarchy and relative spacing.",
        "Use semantic HTML structure with accessible heading order.",
        "Follow normalized palette roles, typography scale, radius, and shadow scales.",
        "Treat captured assets as references only (do not redistribute binaries).",
      ],
      warnings: [
        "Theme-based reconstruction only: do not copy proprietary branding verbatim.",
        ...(styleSpecValidation.success
          ? []
          : [
              `Style spec validation warning: ${styleSpecValidation.error.issues
                .slice(0, 2)
                .map((issue) => `${issue.path.join(".")} ${issue.message}`)
                .join("; ")}`,
            ]),
      ],
    },
    confidence: {
      overall: clampConfidence(Math.min(1, snapshot.prominentNodes.length / 20)),
      sections: styleSpec.sections.map((section, index) => ({
        section_id: `section_${index + 1}`,
        score: clampConfidence(
          0.55 +
            Math.min(
              0.4,
              ((section.bounds.width * section.bounds.height) /
                (snapshot.viewport.width * snapshot.viewport.height)) *
                0.8,
            ),
        ),
      })),
    },
    vision_summary: {
      dominant_colors: dominantColors,
      notes: [
        ...buildVisionNotes({
          screenshotWidth: snapshot.viewport.width,
          screenshotHeight: snapshot.viewport.height,
          dominantColors,
        }),
        ...(styleSpec.vision?.notes ?? []),
      ],
    },
    style_spec: styleSpec,
  };

  // Keep backward compatibility for older tabs that still read histogram fields.
  if (!pack.design_tokens.colors.length) {
    pack.design_tokens.colors = buildLegacyColors(snapshot);
  }

  if (!pack.design_tokens.spacing.length) {
    pack.design_tokens.spacing = buildLegacySpacing(snapshot);
  }

  if (!pack.design_tokens.radii.length) {
    pack.design_tokens.radii = buildLegacyRadii(snapshot);
  }

  return pack;
}

function captureSnapshotInPage() {
  const MAX_NODES = 1200;
  const MAX_PROMINENT = 40;
  const MAX_ROOT_VARS = 200;
  const styleKeys = [
    "display",
    "position",
    "color",
    "backgroundColor",
    "backgroundImage",
    "borderColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "margin",
    "padding",
    "gap",
    "rowGap",
    "columnGap",
    "borderRadius",
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomLeftRadius",
    "borderBottomRightRadius",
    "boxShadow",
    "border",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderTopStyle",
    "borderRightStyle",
    "borderBottomStyle",
    "borderLeftStyle",
    "filter",
    "backdropFilter",
    "justifyContent",
    "alignItems",
    "textTransform",
    "textDecorationLine",
    "width",
    "maxWidth",
    "flexDirection",
    "gridTemplateColumns",
  ];

  const visible = (el: Element) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      style.opacity !== "0"
    );
  };

  const toSelector = (el: Element) => {
    const base = [el.tagName.toLowerCase()];
    if (el.id) {
      base.push(`#${el.id}`);
    }
    const classes = [...el.classList].slice(0, 2);
    if (classes.length) {
      base.push(`.${classes.join(".")}`);
    }
    return base.join("");
  };

  const nodes: ExtractionSnapshot["nodes"] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();

  while (current) {
    const el = current as Element;
    if (nodes.length >= MAX_NODES) break;
    current = walker.nextNode();
    if (!visible(el)) continue;

    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    const styleMap: Record<string, string> = {};
    for (const key of styleKeys) {
      styleMap[key] = styles[key as keyof CSSStyleDeclaration]?.toString() ?? "";
    }

    nodes.push({
      selector: toSelector(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || "",
      text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
      x: rect.x,
      y: rect.y + window.scrollY,
      width: rect.width,
      height: rect.height,
      styles: styleMap,
    });
  }

  const prominentNodes = nodes
    .filter((node) => node.y < window.innerHeight * 1.25)
    .slice()
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, MAX_PROMINENT);

  const sectionElements = Array.from(
    document.querySelectorAll("header, nav, main, section, article, footer"),
  );
  const sections = sectionElements.map((el) => {
    const rect = el.getBoundingClientRect();
    const children = Array.from(el.children)
      .slice(0, 12)
      .map((child) => toSelector(child));

    return {
      selector: toSelector(el),
      tag: el.tagName.toLowerCase(),
      x: rect.x,
      y: rect.y + window.scrollY,
      width: rect.width,
      height: rect.height,
      children,
    };
  });

  const rootCssVars: Record<string, string> = {};
  const rootStyle = window.getComputedStyle(document.documentElement);
  let cssVarCount = 0;
  for (let index = 0; index < rootStyle.length; index += 1) {
    if (cssVarCount >= MAX_ROOT_VARS) break;
    const property = rootStyle[index];
    if (!property || !property.startsWith("--")) continue;

    const value = rootStyle.getPropertyValue(property).trim();
    if (!value) continue;

    rootCssVars[property] = value;
    cssVarCount += 1;
  }

  const title = document.title || "";
  const bodyText = (document.body?.innerText || "").slice(0, 12000);
  const htmlSnippet = (document.documentElement?.outerHTML || "").slice(0, 50000);

  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((el) => (el.textContent || "").trim())
    .filter(Boolean)
    .slice(0, 24);

  const buttons = Array.from(
    document.querySelectorAll(
      "button, a[role='button'], input[type='button'], input[type='submit']",
    ),
  )
    .map((el) => (el.textContent || el.getAttribute("value") || "").trim())
    .filter(Boolean)
    .slice(0, 24);

  const navItems = Array.from(document.querySelectorAll("nav a, header a"))
    .map((el) => (el.textContent || "").trim())
    .filter(Boolean)
    .slice(0, 24);

  const images = Array.from(document.querySelectorAll("img[src]"))
    .map((img) => ({
      url: img.getAttribute("src") || "",
      selector: toSelector(img),
    }))
    .filter((item) => Boolean(item.url))
    .slice(0, 120);

  const icons = Array.from(document.querySelectorAll("link[rel*='icon']"))
    .map((link) => ({
      url: link.getAttribute("href") || "",
      rel: link.getAttribute("rel") || "icon",
    }))
    .filter((item) => Boolean(item.url))
    .slice(0, 30);

  const fonts: Array<{ family: string; source: string }> = [];
  if (document.fonts && document.fonts.forEach) {
    document.fonts.forEach((font) => {
      fonts.push({
        family: font.family || "",
        source: font.status || "unknown",
      });
    });
  }

  return {
    title,
    bodyText,
    htmlSnippet,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    headings,
    buttons,
    navItems,
    nodes,
    prominentNodes,
    sections,
    rootCssVars,
    assets: {
      images,
      fonts,
      icons,
    },
  };
}

async function captureAttempt(input: {
  page: Page;
  url: string;
  mode: "legacy" | "fast";
  config: CaptureTimeoutConfig;
  backstopUsed: boolean;
  backstopReason: "low_completeness" | "attempt_failed" | null;
}) {
  const { page, url, mode, config } = input;
  const totalStarted = Date.now();
  let navigationMs = 0;
  let networkIdleMs = 0;
  let settleMs = 0;
  let snapshotMs = 0;
  let screenshotMs = 0;

  page.setDefaultNavigationTimeout(config.navTimeoutMs);
  page.setDefaultTimeout(config.navTimeoutMs);

  const navigationStarted = Date.now();
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: config.navTimeoutMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("Timeout")) {
      throw error;
    }

    await page.goto(url, {
      waitUntil: "commit",
      timeout: config.navFallbackTimeoutMs,
    });
  }
  navigationMs = Date.now() - navigationStarted;

  const networkIdleStarted = Date.now();
  try {
    await page.waitForLoadState("networkidle", { timeout: config.networkIdleWaitMs });
  } catch {
    // Some pages never become network-idle because of live polling.
  }
  networkIdleMs = Date.now() - networkIdleStarted;

  const settleStarted = Date.now();
  await page.waitForTimeout(config.captureSettleMs);
  settleMs = Date.now() - settleStarted;

  const snapshotStarted = Date.now();
  const snapshot = (await page.evaluate(captureSnapshotInPage)) as ExtractionSnapshot;
  snapshotMs = Date.now() - snapshotStarted;

  const loginWall = detectLoginWall({
    url,
    title: snapshot.title,
    html: snapshot.htmlSnippet,
    bodyText: snapshot.bodyText,
  });

  if (loginWall) {
    throw new ExtractionError(
      "AUTH_REQUIRED_UNSUPPORTED",
      "Page appears to require login and is not supported in MVP",
      400,
    );
  }

  const screenshotStarted = Date.now();
  let screenshotBuffer: Buffer;
  try {
    screenshotBuffer = (await page.screenshot({
      fullPage: true,
      type: "png",
      timeout: config.screenshotTimeoutMs,
    })) as Buffer;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("Timeout")) {
      throw error;
    }

    screenshotBuffer = (await page.screenshot({
      fullPage: false,
      type: "png",
      timeout: config.screenshotFallbackTimeoutMs,
    })) as Buffer;
  }
  screenshotMs = Date.now() - screenshotStarted;

  const dominantColors = extractDominantColorsFromPng(Buffer.from(screenshotBuffer));
  const pack = buildPack({
    url,
    snapshot,
    dominantColors,
  });

  const timing: CaptureTiming = {
    mode,
    backstop_used: input.backstopUsed,
    backstop_reason: input.backstopReason,
    used_config: {
      nav_timeout_ms: config.navTimeoutMs,
      nav_fallback_timeout_ms: config.navFallbackTimeoutMs,
      network_idle_wait_ms: config.networkIdleWaitMs,
      capture_settle_ms: config.captureSettleMs,
      screenshot_timeout_ms: config.screenshotTimeoutMs,
      screenshot_fallback_timeout_ms: config.screenshotFallbackTimeoutMs,
    },
    phase_ms: {
      navigation_ms: navigationMs,
      network_idle_ms: networkIdleMs,
      settle_ms: settleMs,
      snapshot_ms: snapshotMs,
      screenshot_ms: screenshotMs,
      total_ms: Date.now() - totalStarted,
    },
    snapshot_counts: {
      nodes: snapshot.nodes.length,
      prominent_nodes: snapshot.prominentNodes.length,
      sections: snapshot.sections.length,
    },
  };

  return {
    pack,
    screenshotBuffer: Buffer.from(screenshotBuffer),
    traceBuffer: Buffer.from(snapshot.htmlSnippet, "utf8"),
    snapshot,
    timing,
  };
}

export async function captureDesignDna(url: string) {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 2400 },
      userAgent:
        "Mozilla/5.0 (compatible; DesignDNA/0.1; +https://getdesigndna.com)",
    });

    const page = await context.newPage();
    const useFastMode = isFastCaptureModeEnabled();
    const legacyConfig = getCaptureTimeoutConfig("legacy");
    const fastConfig = getCaptureTimeoutConfig("fast");
    const primaryMode: "legacy" | "fast" = useFastMode ? "fast" : "legacy";
    const primaryConfig = useFastMode ? fastConfig : legacyConfig;

    try {
      const primary = await captureAttempt({
        page,
        url,
        mode: primaryMode,
        config: primaryConfig,
        backstopUsed: false,
        backstopReason: null,
      });

      if (useFastMode && shouldRetryForCompleteness(primary.snapshot)) {
        try {
          return await captureAttempt({
            page,
            url,
            mode: "legacy",
            config: legacyConfig,
            backstopUsed: true,
            backstopReason: "low_completeness",
          });
        } catch {
          // Keep fast result if legacy retry fails.
          return primary;
        }
      }

      return primary;
    } catch (primaryError) {
      if (!useFastMode) {
        throw primaryError;
      }

      return await captureAttempt({
        page,
        url,
        mode: "legacy",
        config: legacyConfig,
        backstopUsed: true,
        backstopReason: "attempt_failed",
      });
    }
  } catch (error) {
    if (error instanceof ExtractionError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes("Timeout")) {
      throw new ExtractionError("TIMEOUT", "Capture timed out", 504);
    }

    throw new ExtractionError(
      "CAPTURE_FAILED",
      error instanceof Error ? error.message : "Capture failed",
      500,
    );
  } finally {
    await browser.close();
  }
}
