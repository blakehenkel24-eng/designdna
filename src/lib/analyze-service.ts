import type { User } from "@supabase/supabase-js";

import { captureDesignDna } from "@/lib/extractor/playwright-extractor";
import { enhanceWithOpenAi } from "@/lib/openai-enhance";
import {
  buildExportV1,
  buildPreviewPayload,
  consumeAnalysisForUser,
  getOrCreateEntitlementForUser,
  getRecentHistoryByUrl,
  saveHistoryItem,
  trackEvent,
} from "@/lib/pricing";
import type { AnalysisExportV1 } from "@/lib/pricing-types";
import { checkAnalysisRateLimit } from "@/lib/rate-limit";
import { assertRobotsAllowed } from "@/lib/robots";
import { assertPublicTarget, normalizeUrl } from "@/lib/url-security";
import { toPublicErrorMessage } from "@/lib/errors";

const FREE_LIMIT = 10;
const ANONYMOUS_LIFETIME_LIMIT = 1;

type AnalyzeCaptureTiming = {
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

type AnalyzeLlmTiming = {
  timeout_ms: number;
  max_attempts: number;
  attempt_count: number;
  total_ms: number;
  reduced_payload: boolean;
  final_path: "no_api_key" | "strict_success" | "repair_success" | "deterministic_fallback";
  attempts: Array<{
    name: "strict" | "repair";
    strict_schema: boolean;
    duration_ms: number;
    outcome: "success" | "request_error" | "parse_error" | "validation_error";
    error?: string;
  }>;
  final_error?: string;
};

type AnalyzeTiming = {
  preflight_ms: number;
  capture_ms: number;
  llm_ms: number;
  persist_ms: number;
  total_ms: number;
  capture_detail: AnalyzeCaptureTiming | null;
  llm_detail: AnalyzeLlmTiming | null;
};

export type AnalyzeSuccess = {
  ok: true;
  sourceUrl: string;
  summary: string;
  prompt: string;
  designBlueprint: {
    themeReference: string;
    colors: string[];
    typography: string[];
    effects: string[];
    htmlStructure: string[];
  };
  preview: ReturnType<typeof buildPreviewPayload>;
  exportJson: ReturnType<typeof buildExportV1>;
  historyId: string | null;
  anonymousUsesConsumed: number;
  entitlement: {
    plan: string;
    used: number;
    limit: number;
    remaining: number;
    canExportJson: boolean;
    canViewHistory: boolean;
  };
  timing: AnalyzeTiming;
};

export type AnalyzeFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  timing?: AnalyzeTiming;
  entitlement?: {
    plan: string;
    used: number;
    limit: number;
    remaining: number;
    canExportJson: boolean;
    canViewHistory: boolean;
  };
};

function buildEmptyTiming(): AnalyzeTiming {
  return {
    preflight_ms: 0,
    capture_ms: 0,
    llm_ms: 0,
    persist_ms: 0,
    total_ms: 0,
    capture_detail: null,
    llm_detail: null,
  };
}

function trackEventSafe(
  eventName: string,
  input: {
    userId?: string;
    payload?: Record<string, unknown>;
  },
) {
  void trackEvent(eventName, input).catch(() => {
    // Telemetry should not affect analysis completion.
  });
}

export async function runAnalysis(input: {
  rawUrl: string;
  user: User | null;
  anonymousUses: number;
  rateLimitId: string;
}) {
  const timing = buildEmptyTiming();

  const rate = await checkAnalysisRateLimit(input.rateLimitId);
  if (!rate.allowed) {
    return {
      ok: false,
      status: 429,
      code: "RATE_LIMITED",
      message: "Too many analyze requests. Try again in about a minute.",
    } satisfies AnalyzeFailure;
  }

  let normalized: URL;
  try {
    normalized = normalizeUrl(input.rawUrl);
  } catch (error) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_URL",
      message: error instanceof Error ? error.message : "Invalid URL",
    } satisfies AnalyzeFailure;
  }

  if (input.user) {
    trackEventSafe("analyze_clicked", {
      userId: input.user.id,
      payload: { source: "landing", source_url: normalized.toString() },
    });

    const recent = await getRecentHistoryByUrl(input.user, normalized.toString(), 10);
    if (recent) {
      const preview = (recent.preview_payload ?? {}) as {
        summary?: string;
        prompt?: string;
        theme_reference?: string;
        colors?: string[];
        typography?: string[];
        effects?: string[];
        html_structure?: string[];
      };
      const exportJson = (recent.export_payload ?? {}) as AnalysisExportV1;
      const entitlement = await getOrCreateEntitlementForUser(input.user);

      return {
        ok: true,
        sourceUrl: recent.source_url,
        summary: preview.summary ?? "",
        prompt: preview.prompt ?? "",
        designBlueprint: {
          themeReference:
            preview.theme_reference ??
            "Based on the source site's visual theme and structure.",
          colors: preview.colors ?? [],
          typography: preview.typography ?? [],
          effects: preview.effects ?? [],
          htmlStructure: preview.html_structure ?? [],
        },
        preview: {
          source_url: recent.source_url,
          summary: preview.summary ?? "",
          prompt: preview.prompt ?? "",
          theme_reference:
            preview.theme_reference ??
            "Based on the source site's visual theme and structure.",
          typography: preview.typography ?? [],
          colors: preview.colors ?? [],
          effects: preview.effects ?? [],
          html_structure: preview.html_structure ?? [],
        },
        exportJson,
        historyId: recent.id,
        anonymousUsesConsumed: input.anonymousUses,
        entitlement: {
          plan: entitlement.plan,
          used: entitlement.analyses_used_this_period,
          limit: entitlement.analyses_limit_this_period + entitlement.topup_balance,
          remaining: entitlement.remaining_analyses,
          canExportJson: entitlement.can_export_json,
          canViewHistory: entitlement.can_view_history,
        },
        timing,
      } satisfies AnalyzeSuccess;
    }
  }

  if (!input.user && input.anonymousUses >= ANONYMOUS_LIFETIME_LIMIT) {
    trackEventSafe("paywall_viewed", {
      payload: { location: "analyze_login_required" },
    });
    return {
      ok: false,
      status: 401,
      code: "AUTH_REQUIRED_LOGIN",
      message:
        "Guest access includes 1 lifetime analysis. Log in or sign up to continue with 10 analyses per month.",
      entitlement: {
        plan: "ANONYMOUS",
        used: ANONYMOUS_LIFETIME_LIMIT,
        limit: ANONYMOUS_LIFETIME_LIMIT,
        remaining: 0,
        canExportJson: false,
        canViewHistory: false,
      },
    } satisfies AnalyzeFailure;
  }

  let entitlement = input.user
    ? {
        plan: "FREE",
        used: 0,
        limit: FREE_LIMIT,
        remaining: FREE_LIMIT,
        canExportJson: false,
        canViewHistory: true,
      }
    : {
        plan: "ANONYMOUS",
        used: Math.min(ANONYMOUS_LIFETIME_LIMIT, input.anonymousUses + 1),
        limit: ANONYMOUS_LIFETIME_LIMIT,
        remaining: Math.max(0, ANONYMOUS_LIFETIME_LIMIT - (input.anonymousUses + 1)),
        canExportJson: false,
        canViewHistory: false,
      };

  if (input.user) {
    const consumed = await consumeAnalysisForUser(input.user);
    if (!consumed.allowed) {
      trackEventSafe("limit_hit", {
        userId: input.user.id,
        payload: { plan: consumed.entitlement.plan },
      });
      trackEventSafe("paywall_viewed", {
        userId: input.user.id,
        payload: { location: "analyze_limit_hit", plan: consumed.entitlement.plan },
      });

      return {
        ok: false,
        status: 402,
        code: "LIMIT_HIT",
        message: "Monthly analysis limit reached. Upgrade to the paid plan for higher limits.",
        entitlement: {
          plan: consumed.entitlement.plan,
          used: consumed.entitlement.analyses_used_this_period,
          limit:
            consumed.entitlement.analyses_limit_this_period +
            consumed.entitlement.topup_balance,
          remaining: consumed.entitlement.remaining_analyses,
          canExportJson: consumed.entitlement.can_export_json,
          canViewHistory: consumed.entitlement.can_view_history,
        },
      } satisfies AnalyzeFailure;
    }

    entitlement = {
      plan: consumed.entitlement.plan,
      used: consumed.entitlement.analyses_used_this_period,
      limit:
        consumed.entitlement.analyses_limit_this_period +
        consumed.entitlement.topup_balance,
      remaining: consumed.entitlement.remaining_analyses,
      canExportJson: consumed.entitlement.can_export_json,
      canViewHistory: consumed.entitlement.can_view_history,
    };
  }

  try {
    const pipelineStarted = Date.now();
    const preflightStarted = Date.now();
    await Promise.all([assertPublicTarget(normalized), assertRobotsAllowed(normalized)]);
    timing.preflight_ms = Date.now() - preflightStarted;

    const captureStarted = Date.now();
    const capture = await captureDesignDna(normalized.toString());
    timing.capture_ms = Date.now() - captureStarted;
    timing.capture_detail = capture.timing;

    const aiStarted = Date.now();
    const ai = await enhanceWithOpenAi(capture.pack);
    timing.llm_ms = Date.now() - aiStarted;
    timing.llm_detail = ai.llmTiming ?? null;
    const styleSpecValidationPassed = !capture.pack.recreation_guidance.warnings.some(
      (warning) => warning.startsWith("Style spec validation warning:"),
    );

    const designBlueprint = {
      themeReference:
        ai.designBlueprint?.themeReference ??
        "Based on the source site's visual theme and structure.",
      colors: ai.designBlueprint?.colors ?? [],
      typography: ai.designBlueprint?.typography ?? [],
      effects: ai.designBlueprint?.effects ?? [],
      htmlStructure: ai.designBlueprint?.htmlStructure ?? [],
    };

    const previewPayload = buildPreviewPayload({
      sourceUrl: normalized.toString(),
      summary: ai.summary,
      prompt: ai.prompt,
      designBlueprint,
    });

    const exportJson = buildExportV1({
      sourceUrl: normalized.toString(),
      prompt: ai.prompt,
      pack: capture.pack,
      tokensJson: ai.tokensJson,
      summary: ai.summary,
      designBlueprint,
    });

    let historyId: string | null = null;
    const persistStarted = Date.now();
    if (input.user) {
      const saved = await saveHistoryItem(
        input.user,
        normalized.toString(),
        previewPayload,
        exportJson,
      );
      historyId = saved.id;
    }
    timing.persist_ms = Date.now() - persistStarted;
    timing.total_ms = Date.now() - pipelineStarted;

    trackEventSafe("analysis_succeeded", {
      userId: input.user?.id,
      payload: {
        source_url: normalized.toString(),
        metrics: {
          total_ms: timing.total_ms,
          preflight_ms: timing.preflight_ms,
          capture_ms: timing.capture_ms,
          llm_ms: timing.llm_ms,
          persist_ms: timing.persist_ms,
          capture_detail: timing.capture_detail,
          llm_detail: timing.llm_detail,
          component_count: capture.pack.components.length,
          section_count: capture.pack.layout_map.sections.length,
          style_spec_available: Boolean(capture.pack.style_spec),
          style_spec_validation_passed: styleSpecValidationPassed,
          schema_version: "1.0",
        },
      },
    });

    return {
      ok: true,
      sourceUrl: normalized.toString(),
      summary: ai.summary,
      prompt: ai.prompt,
      designBlueprint,
      preview: previewPayload,
      exportJson,
      historyId,
      anonymousUsesConsumed: input.user
        ? input.anonymousUses
        : Math.min(ANONYMOUS_LIFETIME_LIMIT, input.anonymousUses + 1),
      entitlement,
      timing,
    } satisfies AnalyzeSuccess;
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Analysis failed";
    const message = toPublicErrorMessage(error);
    timing.total_ms =
      timing.total_ms > 0
        ? timing.total_ms
        : timing.preflight_ms + timing.capture_ms + timing.llm_ms + timing.persist_ms;

    trackEventSafe("analysis_failed", {
      userId: input.user?.id,
      payload: {
        message: rawMessage,
        public_message: message,
        metrics: {
          total_ms: timing.total_ms,
          preflight_ms: timing.preflight_ms,
          capture_ms: timing.capture_ms,
          llm_ms: timing.llm_ms,
          persist_ms: timing.persist_ms,
          capture_detail: timing.capture_detail,
          llm_detail: timing.llm_detail,
        },
      },
    });

    return {
      ok: false,
      status: 400,
      code: "ANALYSIS_FAILED",
      message,
      entitlement,
      timing,
    } satisfies AnalyzeFailure;
  }
}
