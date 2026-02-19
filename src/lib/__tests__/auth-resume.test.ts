import { describe, expect, it } from "vitest";

import {
  appendAuthSuccessFlag,
  DEFAULT_NEXT_PATH,
  parsePendingAuthAction,
  sanitizeNextPath,
} from "@/lib/auth-resume";

describe("sanitizeNextPath", () => {
  it("accepts safe internal paths", () => {
    expect(sanitizeNextPath("/designdna-exact.html")).toBe("/designdna-exact.html");
    expect(sanitizeNextPath("/login?next=%2Fdesigndna-exact.html")).toBe(
      "/login?next=%2Fdesigndna-exact.html",
    );
  });

  it("rejects external or malformed paths", () => {
    expect(sanitizeNextPath("https://evil.com")).toBe(DEFAULT_NEXT_PATH);
    expect(sanitizeNextPath("//evil.com")).toBe(DEFAULT_NEXT_PATH);
    expect(sanitizeNextPath("javascript:alert(1)")).toBe(DEFAULT_NEXT_PATH);
  });
});

describe("appendAuthSuccessFlag", () => {
  it("adds auth flag with proper delimiter", () => {
    expect(appendAuthSuccessFlag("/designdna-exact.html")).toBe(
      "/designdna-exact.html?auth=success",
    );
    expect(appendAuthSuccessFlag("/designdna-exact.html?foo=bar")).toBe(
      "/designdna-exact.html?foo=bar&auth=success",
    );
  });
});

describe("parsePendingAuthAction", () => {
  const now = Date.parse("2026-02-19T20:00:00.000Z");

  it("accepts valid analyze payload", () => {
    const parsed = parsePendingAuthAction(
      JSON.stringify({
        type: "analyze",
        url: "https://example.com",
        created_at: "2026-02-19T19:45:00.000Z",
      }),
      now,
    );

    expect(parsed).toEqual({
      type: "analyze",
      url: "https://example.com",
      created_at: "2026-02-19T19:45:00.000Z",
    });
  });

  it("rejects stale or malformed payloads", () => {
    expect(
      parsePendingAuthAction(
        JSON.stringify({
          type: "analyze",
          url: "https://example.com",
          created_at: "2026-02-19T18:00:00.000Z",
        }),
        now,
      ),
    ).toBeNull();

    expect(parsePendingAuthAction("not-json", now)).toBeNull();
    expect(
      parsePendingAuthAction(
        JSON.stringify({
          type: "export_json",
          created_at: "2026-02-19T19:50:00.000Z",
        }),
        now,
      ),
    ).toBeNull();
  });
});
