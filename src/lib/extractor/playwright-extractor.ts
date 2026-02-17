import { chromium } from "playwright";

import { ExtractionError } from "@/lib/errors";
import { detectLoginWall } from "@/lib/extractor/login-wall";
import {
  buildVisionNotes,
  extractDominantColorsFromPng,
} from "@/lib/extractor/vision";
import type { DesignDnaPack } from "@/lib/types";

type CapturedNode = {
  selector: string;
  tag: string;
  role: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  styles: Record<string, string>;
};

type ExtractionSnapshot = {
  title: string;
  bodyText: string;
  htmlSnippet: string;
  viewport: { width: number; height: number };
  headings: string[];
  buttons: string[];
  navItems: string[];
  nodes: CapturedNode[];
  sections: Array<{
    selector: string;
    tag: string;
    x: number;
    y: number;
    width: number;
    height: number;
    children: string[];
  }>;
  assets: {
    images: Array<{ url: string; selector: string }>;
    fonts: Array<{ family: string; source: string }>;
    icons: Array<{ url: string; rel: string }>;
  };
};

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || normalized === "none" || normalized === "normal") {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()].map(([value, count]) => ({ value, count }));
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
    "color",
    "backgroundColor",
    "padding",
    "margin",
    "borderRadius",
    "boxShadow",
  ];

  return keys
    .map((key) => `${key}:${styles[key] ?? ""}`)
    .filter((entry) => !entry.endsWith(":"))
    .join(";");
}

function buildPack(input: {
  url: string;
  snapshot: ExtractionSnapshot;
  dominantColors: string[];
}) {
  const { snapshot, dominantColors } = input;
  const allStyles = snapshot.nodes.map((node) => node.styles);

  const pack: DesignDnaPack = {
    meta: {
      url: input.url,
      captured_at: new Date().toISOString(),
      capture_version: "design_dna_pack_v1",
      viewport: snapshot.viewport,
      compliance_flags: {
        robots_allowed: true,
        blocked: false,
      },
    },
    design_tokens: {
      colors: countValues(
        allStyles.flatMap((style) => [style.color, style.backgroundColor, style.borderColor]),
      ),
      typography: {
        families: countValues(allStyles.map((style) => style.fontFamily)),
        sizes: countValues(allStyles.map((style) => style.fontSize)),
        weights: countValues(allStyles.map((style) => style.fontWeight)),
        line_heights: countValues(allStyles.map((style) => style.lineHeight)),
      },
      spacing: countValues(allStyles.flatMap((style) => [style.margin, style.padding, style.gap])),
      radii: countValues(allStyles.map((style) => style.borderRadius)),
      shadows: countValues(allStyles.map((style) => style.boxShadow)),
      borders: countValues(allStyles.map((style) => style.border)),
      effects: countValues(allStyles.flatMap((style) => [style.filter, style.backdropFilter])),
    },
    layout_map: {
      sections: snapshot.sections.map((section, index) => ({
        id: `section_${index + 1}`,
        selector: section.selector,
        role: section.tag,
        bounds: {
          x: section.x,
          y: section.y,
          width: section.width,
          height: section.height,
        },
        children: section.children,
        responsive_hints: [
          section.width > snapshot.viewport.width * 0.9
            ? "full-width container"
            : "contained width",
          section.y < snapshot.viewport.height
            ? "above fold"
            : "below fold",
        ],
      })),
    },
    components: snapshot.nodes
      .filter((node) => node.width > 20 && node.height > 20)
      .slice(0, 60)
      .map((node, index) => ({
        id: `component_${index + 1}`,
        selector: node.selector,
        type: node.role || node.tag,
        text_preview: node.text,
        style_signature: styleSignature(node.styles),
      })),
    assets: snapshot.assets,
    content_summary: {
      title: snapshot.title,
      headings: snapshot.headings,
      buttons: snapshot.buttons,
      nav_items: snapshot.navItems,
    },
    recreation_guidance: {
      objective: "Recreate this page as semantic HTML + CSS with visual parity.",
      constraints: [
        "Maintain section hierarchy and relative spacing.",
        "Use semantic tags for header/nav/main/section/footer patterns.",
        "Preserve typographic scale and color hierarchy from extracted tokens.",
        "Treat captured assets as references only (do not redistribute binaries).",
      ],
      warnings: [],
    },
    confidence: {
      overall: clampConfidence(Math.min(1, snapshot.nodes.length / 180)),
      sections: snapshot.sections.map((section, index) => ({
        section_id: `section_${index + 1}`,
        score: clampConfidence(
          0.5 + Math.min(0.5, section.children.length / 8),
        ),
      })),
    },
    vision_summary: {
      dominant_colors: dominantColors,
      notes: buildVisionNotes({
        screenshotWidth: snapshot.viewport.width,
        screenshotHeight: snapshot.viewport.height,
        dominantColors,
      }),
    },
  };

  return pack;
}

function captureSnapshotInPage() {
  const MAX_NODES = 1200;
  const styleKeys = [
    "display",
    "position",
    "color",
    "backgroundColor",
    "borderColor",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "margin",
    "padding",
    "gap",
    "borderRadius",
    "boxShadow",
    "border",
    "filter",
    "backdropFilter",
    "justifyContent",
    "alignItems",
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

  const nodes: CapturedNode[] = [];
  const candidates = Array.from(document.querySelectorAll("body *"));

  for (const el of candidates) {
    if (nodes.length >= MAX_NODES) break;
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
    sections,
    assets: {
      images,
      fonts,
      icons,
    },
  };
}

export async function captureDesignDna(url: string) {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 2400 },
      userAgent:
        "Mozilla/5.0 (compatible; DesignDNA/0.1; +https://designdna.app)",
    });

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });

    const snapshot = (await page.evaluate(captureSnapshotInPage)) as ExtractionSnapshot;

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

    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: "png",
    });

    const dominantColors = extractDominantColorsFromPng(
      Buffer.from(screenshotBuffer),
    );

    const pack = buildPack({
      url,
      snapshot,
      dominantColors,
    });

    return {
      pack,
      screenshotBuffer: Buffer.from(screenshotBuffer),
      traceBuffer: Buffer.from(snapshot.htmlSnippet, "utf8"),
    };
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
