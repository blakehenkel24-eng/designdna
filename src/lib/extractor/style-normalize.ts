export type NormalizedColor = {
  hex: string;
  alpha?: number;
};

export type NormalizedShadow = {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: string;
  alpha?: number;
  inset?: boolean;
};

type Rgb = { r: number; g: number; b: number; a?: number };

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  gray: "#808080",
  grey: "#808080",
  transparent: "transparent",
};

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function componentToHex(value: number) {
  return clampByte(value).toString(16).padStart(2, "0");
}

function parseRgbFunction(input: string): Rgb | null {
  const match = input
    .trim()
    .match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;

  const parts = match[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) return null;

  const rgb = parts.slice(0, 3).map((part) => Number.parseFloat(part));
  if (rgb.some((value) => Number.isNaN(value))) return null;

  const alpha =
    parts.length >= 4 ? Number.parseFloat(parts[3]) : undefined;

  return {
    r: rgb[0],
    g: rgb[1],
    b: rgb[2],
    a:
      alpha !== undefined && !Number.isNaN(alpha)
        ? Math.max(0, Math.min(1, alpha))
        : undefined,
  };
}

function parseHex(input: string): Rgb | null {
  const value = input.trim().toLowerCase();
  if (!value.startsWith("#")) return null;

  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length)) return null;

  if (hex.length === 3 || hex.length === 4) {
    const expanded = hex
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
    const hasAlpha = expanded.length === 8;

    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
      a: hasAlpha ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : undefined,
    };
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : undefined,
  };
}

export function rgbToHex(input: Rgb) {
  return `#${componentToHex(input.r)}${componentToHex(input.g)}${componentToHex(input.b)}`;
}

export function normalizeColor(value: string): NormalizedColor | null {
  const raw = value.trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  if (
    lowered === "transparent" ||
    lowered === "currentcolor" ||
    lowered === "none" ||
    lowered === "inherit" ||
    lowered === "initial"
  ) {
    return null;
  }

  const named = NAMED_COLORS[lowered];
  if (named) {
    if (named === "transparent") return null;
    return { hex: named };
  }

  const parsedHex = parseHex(raw);
  if (parsedHex) {
    const hex = rgbToHex(parsedHex);
    if (parsedHex.a === undefined || parsedHex.a >= 0.999) {
      return { hex };
    }
    return { hex, alpha: Number(parsedHex.a.toFixed(3)) };
  }

  const parsedRgb = parseRgbFunction(raw);
  if (parsedRgb) {
    const hex = rgbToHex(parsedRgb);
    if (parsedRgb.a === undefined || parsedRgb.a >= 0.999) {
      return { hex };
    }
    return { hex, alpha: Number(parsedRgb.a.toFixed(3)) };
  }

  return null;
}

export function normalizeFontFamily(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw === "inherit" || raw === "initial" || raw === "normal") {
    return null;
  }

  const first = raw.split(",")[0]?.trim();
  if (!first) return null;

  const cleaned = first.replace(/^['"]|['"]$/g, "").trim();
  return cleaned || null;
}

export function normalizeFontWeight(value: string): number | null {
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "inherit" || raw === "initial") {
    return null;
  }

  if (raw === "normal") return 400;
  if (raw === "bold") return 700;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

export function parsePxList(shorthand: string): number[] {
  if (!shorthand) return [];

  const matches = shorthand.match(/-?\d*\.?\d+px/gi);
  if (!matches) return [];

  return matches
    .map((match) => Number.parseFloat(match))
    .filter((value) => Number.isFinite(value));
}

export function parsePxValue(value: string): number | null {
  const match = value.trim().match(/-?\d*\.?\d+px/i);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitShadowSegments(value: string): string[] {
  const segments: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if (char === "," && depth === 0) {
      if (current.trim()) segments.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    segments.push(current.trim());
  }

  return segments;
}

export function normalizeShadow(value: string): NormalizedShadow[] {
  const raw = value.trim();
  if (!raw || raw === "none") return [];

  const segments = splitShadowSegments(raw);
  const result: NormalizedShadow[] = [];

  for (const segment of segments) {
    const hasInset = /\binset\b/i.test(segment);
    const cleanSegment = segment.replace(/\binset\b/gi, " ").trim();
    const colorMatch = cleanSegment.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}|\b[a-zA-Z]+\b)/);

    let color: NormalizedColor | null = null;
    let withoutColor = cleanSegment;

    if (colorMatch) {
      color = normalizeColor(colorMatch[1]);
      withoutColor = cleanSegment.replace(colorMatch[1], " ").trim();
    }

    const lengths = parsePxList(withoutColor);
    if (lengths.length < 2) {
      continue;
    }

    result.push({
      x: lengths[0],
      y: lengths[1],
      blur: lengths[2] ?? 0,
      spread: lengths[3],
      color: color?.hex ?? "#000000",
      alpha: color?.alpha,
      inset: hasInset || undefined,
    });
  }

  return result;
}

export function toHexWithAlpha(color: NormalizedColor): string {
  if (color.alpha === undefined) {
    return color.hex.toLowerCase();
  }
  const alpha = clampByte(color.alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${color.hex.toLowerCase()}${alpha}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const parsed = parseHex(hex);
  if (!parsed) return null;
  return { r: parsed.r, g: parsed.g, b: parsed.b };
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => v / 255);
  const linear = srgb.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function saturation(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;

  const l = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * l - 1));
}

export function colorDistance(hexA: string, hexB: string): number {
  const rgbA = hexToRgb(hexA);
  const rgbB = hexToRgb(hexB);
  if (!rgbA || !rgbB) return Number.POSITIVE_INFINITY;

  const dr = rgbA.r - rgbB.r;
  const dg = rgbA.g - rgbB.g;
  const db = rgbA.b - rgbB.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
