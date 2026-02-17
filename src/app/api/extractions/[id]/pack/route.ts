import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getArtifactForUser } from "@/lib/db";
import { ExtractionError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const user = await requireUser();
    const artifact = await getArtifactForUser(user.id, params.id);

    if (!artifact) {
      throw new ExtractionError("INTERNAL_ERROR", "Pack not available", 404);
    }

    return NextResponse.json({
      pack: artifact.pack_json,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
