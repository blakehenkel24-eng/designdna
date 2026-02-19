export const DEFAULT_NEXT_PATH = "/designdna-exact.html";
export const PENDING_AUTH_ACTION_MAX_AGE_MS = 30 * 60 * 1000;

export type PendingAuthAction = {
  type: "analyze" | "export_json";
  url?: string;
  analysis_id?: string;
  created_at: string;
};

export function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") {
    return DEFAULT_NEXT_PATH;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) {
    return DEFAULT_NEXT_PATH;
  }

  if (trimmed.startsWith("//")) {
    return DEFAULT_NEXT_PATH;
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return DEFAULT_NEXT_PATH;
    }
  } catch {
    return DEFAULT_NEXT_PATH;
  }

  return trimmed;
}

export function appendAuthSuccessFlag(nextPath: string): string {
  const safePath = sanitizeNextPath(nextPath);
  return safePath.includes("?") ? `${safePath}&auth=success` : `${safePath}?auth=success`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function parsePendingAuthAction(
  input: string | null | undefined,
  nowMs = Date.now(),
): PendingAuthAction | null {
  if (!input) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return null;
  }

  if (!isObject(parsed)) {
    return null;
  }

  const type = parsed.type;
  const createdAt = parsed.created_at;
  const url = parsed.url;
  const analysisId = parsed.analysis_id;

  if (type !== "analyze" && type !== "export_json") {
    return null;
  }

  if (typeof createdAt !== "string") {
    return null;
  }

  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return null;
  }

  if (nowMs - createdAtMs > PENDING_AUTH_ACTION_MAX_AGE_MS) {
    return null;
  }

  if (type === "analyze") {
    if (typeof url !== "string" || url.trim().length === 0) {
      return null;
    }
    return {
      type,
      url,
      created_at: createdAt,
    };
  }

  if (typeof analysisId !== "string" || analysisId.trim().length === 0) {
    return null;
  }

  return {
    type,
    analysis_id: analysisId,
    created_at: createdAt,
  };
}
