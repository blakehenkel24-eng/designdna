import { getServerEnv } from "@/lib/env";
import { ExtractionError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  DesignDnaPack,
  ExtractionArtifactRow,
  ExtractionErrorCode,
  ExtractionRow,
  ExtractionStatus,
} from "@/lib/types";

export async function listUserExtractions(userId: string, limit = 20) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("extractions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new ExtractionError("INTERNAL_ERROR", error.message, 500);
  }

  return (data ?? []) as ExtractionRow[];
}

export async function getExtractionForUser(userId: string, extractionId: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("extractions")
    .select("*")
    .eq("id", extractionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new ExtractionError("INTERNAL_ERROR", error.message, 500);
  }

  return data as ExtractionRow | null;
}

export async function getArtifactForUser(userId: string, extractionId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: extraction, error: extractionError } = await supabase
    .from("extractions")
    .select("id")
    .eq("id", extractionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (extractionError) {
    throw new ExtractionError("INTERNAL_ERROR", extractionError.message, 500);
  }

  if (!extraction) {
    return null;
  }

  const { data, error } = await supabase
    .from("extraction_artifacts")
    .select("*")
    .eq("extraction_id", extractionId)
    .maybeSingle();

  if (error) {
    throw new ExtractionError("INTERNAL_ERROR", error.message, 500);
  }

  return data as ExtractionArtifactRow | null;
}

export async function createExtraction(userId: string, url: string) {
  const env = getServerEnv();
  const expiresAt = new Date(Date.now() + env.ARTIFACT_TTL_HOURS * 60 * 60 * 1000);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("extractions")
    .insert({
      user_id: userId,
      url,
      status: "queued",
      progress_pct: 0,
      expires_at: expiresAt.toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new ExtractionError("INTERNAL_ERROR", error.message, 500);
  }

  return data as ExtractionRow;
}

export async function consumeUserQuotaOrThrow(userId: string) {
  const env = getServerEnv();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc("consume_user_quota", {
    p_user_id: userId,
    p_cap: env.EXTRACTION_DAILY_CAP,
  });

  if (error) {
    throw new ExtractionError("INTERNAL_ERROR", error.message, 500);
  }

  const allowed = Boolean(data);
  if (!allowed) {
    throw new ExtractionError(
      "QUOTA_EXCEEDED",
      `Daily extraction cap (${env.EXTRACTION_DAILY_CAP}) exceeded`,
      429,
    );
  }
}

export async function setExtractionRunning(extractionId: string) {
  return setExtractionStatus(extractionId, "running", 10, {
    started_at: new Date().toISOString(),
    error_code: null,
    error_message: null,
    blocked_reason: null,
  });
}

export async function setExtractionProgress(
  extractionId: string,
  progressPct: number,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("extractions")
    .update({ progress_pct: progressPct })
    .eq("id", extractionId);

  if (error) {
    throw new ExtractionError("INTERNAL_ERROR", error.message, 500);
  }
}

export async function completeExtraction(
  extractionId: string,
  artifact: {
    promptText: string;
    packJson: DesignDnaPack;
    screenshotPath: string | null;
    tracePath: string | null;
  },
) {
  const supabase = createSupabaseAdminClient();

  const { error: artifactError } = await supabase.from("extraction_artifacts").upsert(
    {
      extraction_id: extractionId,
      prompt_text: artifact.promptText,
      pack_json: artifact.packJson,
      screenshot_path: artifact.screenshotPath,
      trace_path: artifact.tracePath,
    },
    { onConflict: "extraction_id" },
  );

  if (artifactError) {
    throw new ExtractionError("INTERNAL_ERROR", artifactError.message, 500);
  }

  await setExtractionStatus(extractionId, "completed", 100, {
    completed_at: new Date().toISOString(),
    error_code: null,
    error_message: null,
    blocked_reason: null,
  });
}

export async function failExtraction(
  extractionId: string,
  code: ExtractionErrorCode,
  message: string,
  blockedReason: string | null = null,
) {
  await setExtractionStatus(extractionId, "failed", 100, {
    completed_at: new Date().toISOString(),
    error_code: code,
    error_message: message,
    blocked_reason: blockedReason,
  });
}

async function setExtractionStatus(
  extractionId: string,
  status: ExtractionStatus,
  progressPct: number,
  extra: Record<string, unknown>,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("extractions")
    .update({ status, progress_pct: progressPct, ...extra })
    .eq("id", extractionId);

  if (error) {
    throw new ExtractionError("INTERNAL_ERROR", error.message, 500);
  }
}
