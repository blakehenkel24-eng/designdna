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

export function toExtractionError(error: unknown): ExtractionError {
  if (error instanceof ExtractionError) {
    return error;
  }

  if (error instanceof Error) {
    return new ExtractionError("INTERNAL_ERROR", error.message, 500);
  }

  return new ExtractionError("INTERNAL_ERROR", "Unknown error", 500);
}
