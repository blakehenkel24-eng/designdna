import { afterEach, describe, expect, it, vi } from "vitest";

import { ExtractionError } from "@/lib/errors";
import { assertRobotsAllowed } from "@/lib/robots";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("assertRobotsAllowed", () => {
  it("allows when robots.txt is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 404 }),
    );

    await expect(assertRobotsAllowed(new URL("https://example.com/path"))).resolves
      .toBeUndefined();
  });

  it("blocks disallowed paths", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("User-agent: *\nDisallow: /private", { status: 200 }),
    );

    await expect(
      assertRobotsAllowed(new URL("https://example.com/private/data")),
    ).rejects.toThrow(ExtractionError);
  });

  it("allows path when explicitly allowed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        "User-agent: *\nDisallow: /\nAllow: /public",
        { status: 200 },
      ),
    );

    await expect(assertRobotsAllowed(new URL("https://example.com/public"))).resolves
      .toBeUndefined();
  });
});
