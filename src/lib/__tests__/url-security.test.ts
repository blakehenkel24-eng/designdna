import { describe, expect, it, vi } from "vitest";

import { ExtractionError } from "@/lib/errors";
import { assertPublicTarget, normalizeUrl } from "@/lib/url-security";

vi.mock("node:dns/promises", () => {
  return {
    default: {
      lookup: vi.fn(),
    },
  };
});

import dns from "node:dns/promises";

describe("normalizeUrl", () => {
  it("accepts http/https URLs", () => {
    const normalized = normalizeUrl("https://example.com/path");
    expect(normalized.toString()).toBe("https://example.com/path");
  });

  it("rejects non-http protocols", () => {
    expect(() => normalizeUrl("ftp://example.com")).toThrow(ExtractionError);
  });

  it("rejects localhost hostnames", () => {
    expect(() => normalizeUrl("http://localhost:3000")).toThrow(ExtractionError);
  });
});

describe("assertPublicTarget", () => {
  it("allows public IP resolutions", async () => {
    vi.mocked(dns.lookup).mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
    ] as never);

    await expect(assertPublicTarget(new URL("https://example.com"))).resolves.toBe(
      undefined,
    );
  });

  it("blocks private IP resolutions", async () => {
    vi.mocked(dns.lookup).mockResolvedValueOnce([
      { address: "192.168.1.10", family: 4 },
    ] as never);

    await expect(
      assertPublicTarget(new URL("https://private.example.com")),
    ).rejects.toThrow(ExtractionError);
  });
});
