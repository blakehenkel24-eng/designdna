import { afterEach, describe, expect, it } from "vitest";

import {
  getCaptureTimeoutConfig,
  isFastCaptureModeEnabled,
} from "@/lib/extractor/playwright-extractor";

afterEach(() => {
  delete process.env.ANALYZE_FAST_MODE_ENABLED;
  delete process.env.ANALYZE_NAV_TIMEOUT_MS;
  delete process.env.ANALYZE_NAV_FALLBACK_TIMEOUT_MS;
  delete process.env.ANALYZE_NETWORK_IDLE_WAIT_MS;
  delete process.env.ANALYZE_CAPTURE_SETTLE_MS;
  delete process.env.ANALYZE_SCREENSHOT_TIMEOUT_MS;
  delete process.env.ANALYZE_SCREENSHOT_FALLBACK_TIMEOUT_MS;
});

describe("playwright extractor config", () => {
  it("uses legacy defaults when fast mode is disabled", () => {
    expect(isFastCaptureModeEnabled()).toBe(false);
    expect(getCaptureTimeoutConfig("legacy")).toEqual({
      navTimeoutMs: 35000,
      navFallbackTimeoutMs: 15000,
      networkIdleWaitMs: 8000,
      captureSettleMs: 1200,
      screenshotTimeoutMs: 20000,
      screenshotFallbackTimeoutMs: 10000,
    });
  });

  it("reads fast mode env overrides", () => {
    process.env.ANALYZE_FAST_MODE_ENABLED = "true";
    process.env.ANALYZE_NAV_TIMEOUT_MS = "21000";
    process.env.ANALYZE_NAV_FALLBACK_TIMEOUT_MS = "9000";
    process.env.ANALYZE_NETWORK_IDLE_WAIT_MS = "2200";
    process.env.ANALYZE_CAPTURE_SETTLE_MS = "450";
    process.env.ANALYZE_SCREENSHOT_TIMEOUT_MS = "7000";
    process.env.ANALYZE_SCREENSHOT_FALLBACK_TIMEOUT_MS = "3500";

    expect(isFastCaptureModeEnabled()).toBe(true);
    expect(getCaptureTimeoutConfig("fast")).toEqual({
      navTimeoutMs: 21000,
      navFallbackTimeoutMs: 9000,
      networkIdleWaitMs: 2200,
      captureSettleMs: 450,
      screenshotTimeoutMs: 7000,
      screenshotFallbackTimeoutMs: 3500,
    });
  });
});
