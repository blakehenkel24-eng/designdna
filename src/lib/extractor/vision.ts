import { PNG } from "pngjs";

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function extractDominantColorsFromPng(buffer: Buffer, sampleStep = 24) {
  const png = PNG.sync.read(buffer);
  const histogram = new Map<string, number>();

  for (let y = 0; y < png.height; y += sampleStep) {
    for (let x = 0; x < png.width; x += sampleStep) {
      const idx = (png.width * y + x) << 2;
      const alpha = png.data[idx + 3];
      if (alpha < 200) continue;

      const r = Math.floor(png.data[idx] / 16) * 16;
      const g = Math.floor(png.data[idx + 1] / 16) * 16;
      const b = Math.floor(png.data[idx + 2] / 16) * 16;

      const key = rgbToHex(r, g, b);
      histogram.set(key, (histogram.get(key) ?? 0) + 1);
    }
  }

  return [...histogram.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([color]) => color);
}

export function buildVisionNotes({
  screenshotWidth,
  screenshotHeight,
  dominantColors,
}: {
  screenshotWidth: number;
  screenshotHeight: number;
  dominantColors: string[];
}) {
  const notes = [
    `Screenshot analyzed at ${screenshotWidth}x${screenshotHeight}.`,
  ];

  if (dominantColors.length > 0) {
    notes.push("Use dominant colors for background layering and accent priority.");
  }

  if (screenshotHeight > screenshotWidth * 2) {
    notes.push("Page appears long-scroll; preserve vertical rhythm between sections.");
  }

  return notes;
}
