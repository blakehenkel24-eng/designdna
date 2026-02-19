import type { User } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DesignDnaPack } from "@/lib/types";
import type { Json } from "@/types/database";
import type {
  AnalysisExportV1,
  EntitlementPlan,
  EntitlementState,
  PreviewPayload,
} from "@/lib/pricing-types";
import type { SemanticTokensJson } from "@/lib/schema/styleSpec.schema";

const FREE_LIMIT = 10;
const PRO_LIMIT = 100;
export const TOPUP_ANALYSES = 40;

function monthBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function planBaseLimit(plan: EntitlementPlan) {
  return plan === "PRO_ACTIVE" || plan === "PRO_CANCELED_GRACE" ? PRO_LIMIT : FREE_LIMIT;
}

function computeRemaining(limit: number, topups: number, used: number) {
  return Math.max(0, limit + topups - used);
}

function toEntitlementState(row: {
  user_id: string;
  plan: EntitlementPlan;
  analyses_used_this_period: number;
  analyses_limit_this_period: number;
  topup_balance: number;
  period_start: string;
  period_end: string;
}): EntitlementState {
  const remaining = computeRemaining(
    row.analyses_limit_this_period,
    row.topup_balance,
    row.analyses_used_this_period,
  );

  const canExport = row.plan === "PRO_ACTIVE" || row.plan === "PRO_CANCELED_GRACE";

  return {
    ...row,
    remaining_analyses: remaining,
    can_export_json: canExport,
    can_view_history: true,
  };
}

export async function getOrCreateEntitlementForUser(user: User) {
  const supabase = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("user_entitlements")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    const bounds = monthBounds();
    const { data: inserted, error: insertError } = await supabase
      .from("user_entitlements")
      .insert({
        user_id: user.id,
        plan: "FREE",
        analyses_used_this_period: 0,
        analyses_limit_this_period: planBaseLimit("FREE"),
        topup_balance: 0,
        period_start: bounds.start,
        period_end: bounds.end,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    return toEntitlementState(inserted);
  }

  const today = new Date().toISOString().slice(0, 10);
  const shouldReset = existing.period_end < today;
  const desiredLimit = planBaseLimit(existing.plan as EntitlementPlan);

  if (!shouldReset && existing.analyses_limit_this_period === desiredLimit) {
    return toEntitlementState(existing as never);
  }

  const bounds = monthBounds();
  const { data: updated, error: updateError } = await supabase
    .from("user_entitlements")
    .update({
      analyses_used_this_period: shouldReset ? 0 : existing.analyses_used_this_period,
      analyses_limit_this_period: desiredLimit,
      topup_balance: shouldReset ? 0 : existing.topup_balance,
      period_start: shouldReset ? bounds.start : existing.period_start,
      period_end: shouldReset ? bounds.end : existing.period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (updateError) {
    throw updateError;
  }

  return toEntitlementState(updated);
}

export async function consumeAnalysisForUser(user: User) {
  const entitlement = await getOrCreateEntitlementForUser(user);

  if (entitlement.remaining_analyses <= 0) {
    return {
      allowed: false,
      entitlement,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: updated, error } = await supabase
    .from("user_entitlements")
    .update({
      analyses_used_this_period: entitlement.analyses_used_this_period + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    allowed: true,
    entitlement: toEntitlementState(updated),
  };
}

export async function grantTopup(user: User, amount = TOPUP_ANALYSES) {
  const entitlement = await getOrCreateEntitlementForUser(user);
  const supabase = createSupabaseAdminClient();

  const { data: updated, error } = await supabase
    .from("user_entitlements")
    .update({
      topup_balance: entitlement.topup_balance + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return toEntitlementState(updated);
}

export async function setUserPlan(user: User, plan: EntitlementPlan) {
  const entitlement = await getOrCreateEntitlementForUser(user);
  const supabase = createSupabaseAdminClient();

  const { data: updated, error } = await supabase
    .from("user_entitlements")
    .update({
      plan,
      analyses_limit_this_period: planBaseLimit(plan),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  // Ensure monthly resets remain deterministic even if plan changed.
  if (entitlement.period_end < new Date().toISOString().slice(0, 10)) {
    const bounds = monthBounds();
    await supabase
      .from("user_entitlements")
      .update({
        period_start: bounds.start,
        period_end: bounds.end,
        analyses_used_this_period: 0,
        topup_balance: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  }

  return toEntitlementState(updated);
}

export async function listHistoryForUser(user: User, query?: string) {
  const entitlement = await getOrCreateEntitlementForUser(user);
  const supabase = createSupabaseAdminClient();

  const limit = entitlement.can_view_history ? 100 : 10;
  let request = supabase
    .from("analysis_history")
    .select("id, source_url, preview_payload, export_payload, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (entitlement.can_view_history && query?.trim()) {
    request = request.ilike("source_url", `%${query.trim()}%`);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return {
    entitlement,
    items: data ?? [],
  };
}

export async function saveHistoryItem(
  user: User,
  sourceUrl: string,
  previewPayload: PreviewPayload,
  exportPayload: AnalysisExportV1,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("analysis_history")
    .insert({
      user_id: user.id,
      source_url: sourceUrl,
      preview_payload: previewPayload as unknown as Json,
      export_payload: exportPayload as unknown as Json,
    })
    .select("id, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getHistoryItemForExport(user: User, analysisId: string) {
  const entitlement = await getOrCreateEntitlementForUser(user);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("analysis_history")
    .select("id, source_url, export_payload, created_at")
    .eq("user_id", user.id)
    .eq("id", analysisId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    entitlement,
    item: data,
  };
}

export async function getRecentHistoryByUrl(
  user: User,
  sourceUrl: string,
  withinMinutes = 10,
) {
  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("analysis_history")
    .select("id, source_url, preview_payload, export_payload, created_at")
    .eq("user_id", user.id)
    .eq("source_url", sourceUrl)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function trackEvent(
  eventName: string,
  options?: {
    userId?: string;
    payload?: Record<string, unknown>;
  },
) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("analytics_events").insert({
    user_id: options?.userId ?? null,
    event_name: eventName,
    event_payload: (options?.payload ?? {}) as Json,
  });
}

export function buildPreviewPayload(input: {
  sourceUrl: string;
  summary: string;
  prompt: string;
  designBlueprint?: {
    themeReference?: string;
    colors?: string[];
    typography?: string[];
    effects?: string[];
    htmlStructure?: string[];
  };
}) {
  return {
    source_url: input.sourceUrl,
    summary: input.summary,
    prompt: input.prompt,
    theme_reference:
      input.designBlueprint?.themeReference ??
      "Based on the source site's visual theme and structure.",
    typography: input.designBlueprint?.typography ?? [],
    colors: input.designBlueprint?.colors ?? [],
    effects: input.designBlueprint?.effects ?? [],
    html_structure: input.designBlueprint?.htmlStructure ?? [],
  } satisfies PreviewPayload;
}

export function buildExportV1(input: {
  sourceUrl: string;
  prompt: string;
  pack: DesignDnaPack;
  tokensJson?: SemanticTokensJson;
  designBlueprint?: {
    colors?: string[];
    typography?: string[];
    effects?: string[];
    htmlStructure?: string[];
  };
  summary: string;
}): AnalysisExportV1 {
  const nonEmpty = <T>(values: T[] | undefined): T[] | undefined =>
    values && values.length > 0 ? values : undefined;

  const styleSpec = input.pack.style_spec;
  const sections =
    input.tokensJson?.sections ??
    styleSpec?.sections.map((section) => ({
      label: section.label,
      selector: section.selector,
      width: Math.round(section.bounds.width),
      height: Math.round(section.bounds.height),
    })) ??
    input.pack.layout_map.sections.slice(0, 12).map((section) => ({
      label: section.role,
      selector: section.selector,
      width: Math.round(section.bounds.width),
      height: Math.round(section.bounds.height),
    }));

  const palette =
    nonEmpty(input.tokensJson?.tokens.color.palette) ??
    nonEmpty(input.designBlueprint?.colors) ??
    nonEmpty(styleSpec?.palette.colors.map((item) => item.hex)) ??
    input.pack.design_tokens.colors.slice(0, 12).map((item) => item.value);

  const typographyFamilies =
    nonEmpty(input.tokensJson?.tokens.typography.families) ??
    nonEmpty(input.designBlueprint?.typography) ??
    nonEmpty(
      [styleSpec?.typography.primaryFamily, styleSpec?.typography.secondaryFamily].filter(
        (value): value is string => Boolean(value),
      ),
    ) ??
    input.pack.design_tokens.typography.families.slice(0, 8).map((item) => item.value);

  const typographyScale =
    input.tokensJson?.tokens.typography.scale ??
    styleSpec?.typography.scale.map((item) => item.px) ??
    input.pack.design_tokens.typography.sizes
      .slice(0, 8)
      .map((item) => Number.parseFloat(item.value))
      .filter((value) => Number.isFinite(value));

  const typographyWeights =
    input.tokensJson?.tokens.typography.weights ??
    styleSpec?.typography.weights ??
    input.pack.design_tokens.typography.weights
      .slice(0, 8)
      .map((item) => Number.parseFloat(item.value))
      .filter((value) => Number.isFinite(value));

  const lineHeights =
    input.tokensJson?.tokens.typography.line_heights ??
    styleSpec?.typography.lineHeights.map((item) => item.value) ??
    input.pack.design_tokens.typography.line_heights
      .slice(0, 8)
      .map((item) => Number.parseFloat(item.value))
      .filter((value) => Number.isFinite(value));

  const spacing =
    input.tokensJson?.tokens.spacing ??
    styleSpec?.tokens.spacingPx.map((item) => item.value) ??
    input.pack.design_tokens.spacing
      .slice(0, 12)
      .map((item) => Number.parseFloat(item.value))
      .filter((value) => Number.isFinite(value));

  const radius =
    input.tokensJson?.tokens.radius ??
    styleSpec?.tokens.radiusPx.map((item) => item.value) ??
    input.pack.design_tokens.radii
      .slice(0, 8)
      .map((item) => Number.parseFloat(item.value))
      .filter((value) => Number.isFinite(value));

  const shadow =
    nonEmpty(input.tokensJson?.tokens.shadow) ??
    nonEmpty(styleSpec?.tokens.shadows.map((item) => item.value)) ??
    input.pack.design_tokens.shadows.slice(0, 8).map((item) => item.value);

  const effects =
    nonEmpty(input.tokensJson?.tokens.effects) ??
    nonEmpty(input.designBlueprint?.effects) ??
    nonEmpty(styleSpec?.tokens.effects.map((item) => item.value)) ??
    input.pack.design_tokens.effects.slice(0, 8).map((item) => item.value);

  return {
    schema_version: "1.0",
    source_url: input.sourceUrl,
    timestamp: new Date().toISOString(),
    design_prompt: input.prompt,
    tokens: {
      color: {
        palette,
        roles: input.tokensJson?.tokens.color.roles ?? styleSpec?.palette.roles ?? {},
      },
      typography: {
        families: typographyFamilies,
        scale: typographyScale,
        weights: typographyWeights,
        line_heights: lineHeights,
      },
      spacing,
      radius,
      shadow,
      effects,
    },
    components: {
      primary_button: styleSpec?.components.primaryButton as Record<string, unknown> | undefined,
      secondary_button: styleSpec?.components.secondaryButton as Record<string, unknown> | undefined,
      card: styleSpec?.components.card as Record<string, unknown> | undefined,
      input: styleSpec?.components.input as Record<string, unknown> | undefined,
      link: styleSpec?.components.link as Record<string, unknown> | undefined,
    },
    sections,
    structure: {
      sections:
        input.designBlueprint?.htmlStructure?.length
          ? input.designBlueprint.htmlStructure
          : input.pack.layout_map.sections.slice(0, 12).map((section) => section.selector),
      hints: input.pack.vision_summary.notes,
    },
    notes: [
      input.summary,
      "Generated from DesignDNA analysis. Adapt branding/content to your own project.",
    ],
    assumptions: [
      "Based on deterministic extraction plus semantic compilation.",
      "Theme reference only; avoid proprietary brand copy.",
    ],
  };
}
