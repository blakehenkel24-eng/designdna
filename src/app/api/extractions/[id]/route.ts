import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getExtractionForUser } from "@/lib/db";
import { ExtractionError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const user = await requireUser();
    const extraction = await getExtractionForUser(user.id, params.id);

    if (!extraction) {
      throw new ExtractionError("INTERNAL_ERROR", "Extraction not found", 404);
    }

    return NextResponse.json({
      item: extraction,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
