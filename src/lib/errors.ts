import type { ExtractionErrorCode } from "@/lib/types";

export class ExtractionError extends Error {
  code: ExtractionErrorCode;
  status: number;

  constructor(code: ExtractionErrorCode, message: string, status = 400) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
    this.status = status;
  }
}

const TEMPORARY_FAILURE_MESSAGE =
  "Analysis failed due to a temporary service issue. Please try again.";
const TIMEOUT_FAILURE_MESSAGE = "Analysis timed out. Please try again.";

function looksLikeInternalRuntimeDetail(message: string) {
  const lowered = message.toLowerCase();
  const patterns = [
    "browsertype.launch",
    "executable doesn't exist",
    "playwright install",
    "chrome-headless-shell",
    "node_modules",
    "enoent",
    "eacces",
    "\n    at ",
  ];
  return patterns.some((pattern) => lowered.includes(pattern));
}

export function toPublicErrorMessageFromParts(code: ExtractionErrorCode, message: string) {
  const trimmed = message.trim();
  switch (code) {
    case "INVALID_URL":
    case "TARGET_BLOCKED":
    case "AUTH_REQUIRED_UNSUPPORTED":
    case "QUOTA_EXCEEDED":
      return trimmed || "Analysis failed.";
    case "TIMEOUT":
      return TIMEOUT_FAILURE_MESSAGE;
    case "NAVIGATION_FAILED":
    case "CAPTURE_FAILED":
    case "INTERNAL_ERROR":
      return TEMPORARY_FAILURE_MESSAGE;
    default:
      return looksLikeInternalRuntimeDetail(trimmed)
        ? TEMPORARY_FAILURE_MESSAGE
        : trimmed || "Analysis failed.";
  }
}

export function toPublicErrorMessage(error: unknown) {
  const extractionError = toExtractionError(error);
  return toPublicErrorMessageFromParts(extractionError.code, extractionError.message);
}

export function toExtractionError(error: unknown): ExtractionError {
  if (error instanceof ExtractionError) {
    return error;
  }

  if (error instanceof Error) {
    return new ExtractionError("INTERNAL_ERROR", error.message, 500);
  }

  return new ExtractionError("INTERNAL_ERROR", "Unknown error", 500);
}
