import { NextResponse } from "next/server";

import { ExtractionError, toExtractionError, toPublicErrorMessage } from "@/lib/errors";

export function errorResponse(error: unknown) {
  const extractionError = toExtractionError(error);
  const publicMessage = toPublicErrorMessage(extractionError);

  return NextResponse.json(
    {
      error: extractionError.code,
      message: publicMessage,
    },
    { status: extractionError.status },
  );
}

export function assert(condition: unknown, code: ExtractionError["code"], message: string) {
  if (!condition) {
    throw new ExtractionError(code, message, 400);
  }
}
