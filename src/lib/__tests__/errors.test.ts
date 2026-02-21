import { describe, expect, it } from "vitest";

import { ExtractionError, toPublicErrorMessage } from "@/lib/errors";

describe("toPublicErrorMessage", () => {
  it("redacts internal runtime details", () => {
    const error = new ExtractionError(
      "CAPTURE_FAILED",
      "browserType.launch: Executable doesn't exist at /home/user/.cache/ms-playwright/...",
      500,
    );

    expect(toPublicErrorMessage(error)).toBe(
      "Analysis failed due to a temporary service issue. Please try again.",
    );
  });

  it("preserves safe user-facing messages", () => {
    const error = new ExtractionError(
      "TARGET_BLOCKED",
      "Target host resolves to a private network address and is blocked",
      400,
    );

    expect(toPublicErrorMessage(error)).toBe(
      "Target host resolves to a private network address and is blocked",
    );
  });
});
