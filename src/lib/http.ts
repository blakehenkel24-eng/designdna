import { NextResponse } from "next/server";

import { ExtractionError, toExtractionError } from "@/lib/errors";

export function errorResponse(error: unknown) {
  const extractionError = toExtractionError(error);

  return NextResponse.json(
    {
      error: extractionError.code,
      message: extractionError.message,
    },
    { status: extractionError.status },
  );
}

export function assert(condition: unknown, code: ExtractionError["code"], message: string) {
  if (!condition) {
    throw new ExtractionError(code, message, 400);
  }
}
