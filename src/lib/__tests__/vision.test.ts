import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import { extractDominantColorsFromPng } from "@/lib/extractor/vision";

describe("extractDominantColorsFromPng", () => {
  it("extracts dominant colors from screenshot bytes", () => {
    const png = new PNG({ width: 20, height: 20 });

    for (let y = 0; y < png.height; y += 1) {
      for (let x = 0; x < png.width; x += 1) {
        const idx = (png.width * y + x) << 2;
        const color = x < 10 ? [255, 0, 0] : [0, 0, 255];
        png.data[idx] = color[0];
        png.data[idx + 1] = color[1];
        png.data[idx + 2] = color[2];
        png.data[idx + 3] = 255;
      }
    }

    const buffer = PNG.sync.write(png);
    const colors = extractDominantColorsFromPng(buffer, 1);

    expect(colors.length).toBeGreaterThan(0);
    expect(colors).toContain("#0000f0");
    expect(colors).toContain("#f00000");
  });
});
