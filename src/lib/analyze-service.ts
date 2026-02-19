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

const FREE_LIMIT = 3;

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
  };
};

export type AnalyzeFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  entitlement?: {
    plan: string;
    used: number;
    limit: number;
    remaining: number;
    canExportJson: boolean;
  };
};

export async function runAnalysis(input: {
  rawUrl: string;
  user: User | null;
  anonymousUses: number;
  rateLimitId: string;
}) {
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
    await trackEvent("analyze_clicked", {
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
        },
      } satisfies AnalyzeSuccess;
    }
  }

  if (!input.user) {
    await trackEvent("paywall_viewed", {
      payload: { location: "analyze_login_required" },
    });
    return {
      ok: false,
      status: 401,
      code: "AUTH_REQUIRED_LOGIN",
      message: "Log in or sign up to run analyses. Free accounts get 3 analyses per month.",
      entitlement: {
        plan: "LOGIN_REQUIRED",
        used: 0,
        limit: FREE_LIMIT,
        remaining: FREE_LIMIT,
        canExportJson: false,
      },
    } satisfies AnalyzeFailure;
  }

  let entitlement = {
    plan: "FREE",
    used: 0,
    limit: FREE_LIMIT,
    remaining: FREE_LIMIT,
    canExportJson: false,
  };

  if (input.user) {
    const consumed = await consumeAnalysisForUser(input.user);
    if (!consumed.allowed) {
      await trackEvent("limit_hit", {
        userId: input.user.id,
        payload: { plan: consumed.entitlement.plan },
      });
      await trackEvent("paywall_viewed", {
        userId: input.user.id,
        payload: { location: "analyze_limit_hit", plan: consumed.entitlement.plan },
      });

      return {
        ok: false,
        status: 402,
        code: "LIMIT_HIT",
        message: "Monthly analysis limit reached. Upgrade or buy a top-up.",
        entitlement: {
          plan: consumed.entitlement.plan,
          used: consumed.entitlement.analyses_used_this_period,
          limit:
            consumed.entitlement.analyses_limit_this_period +
            consumed.entitlement.topup_balance,
          remaining: consumed.entitlement.remaining_analyses,
          canExportJson: consumed.entitlement.can_export_json,
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
    };
  }

  try {
    const pipelineStarted = Date.now();
    await assertPublicTarget(normalized);
    await assertRobotsAllowed(normalized);

    const captureStarted = Date.now();
    const capture = await captureDesignDna(normalized.toString());
    const captureMs = Date.now() - captureStarted;

    const aiStarted = Date.now();
    const ai = await enhanceWithOpenAi(capture.pack);
    const aiMs = Date.now() - aiStarted;
    const totalMs = Date.now() - pipelineStarted;
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
    if (input.user) {
      const saved = await saveHistoryItem(
        input.user,
        normalized.toString(),
        previewPayload,
        exportJson,
      );
      historyId = saved.id;
    }

    await trackEvent("analysis_succeeded", {
      userId: input.user?.id,
      payload: {
        source_url: normalized.toString(),
        metrics: {
          total_ms: totalMs,
          capture_ms: captureMs,
          llm_ms: aiMs,
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
      anonymousUsesConsumed: input.anonymousUses,
      entitlement,
    } satisfies AnalyzeSuccess;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";

    await trackEvent("analysis_failed", {
      userId: input.user?.id,
      payload: { message },
    });

    return {
      ok: false,
      status: 400,
      code: "ANALYSIS_FAILED",
      message,
      entitlement,
    } satisfies AnalyzeFailure;
  }
}
