import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  consumeUserQuotaOrThrow,
  createExtraction,
  listUserExtractions,
} from "@/lib/db";
import { ExtractionError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";
import { enqueueExtractionJob } from "@/lib/queue";
import { requireUser } from "@/lib/auth";
import { normalizeUrl } from "@/lib/url-security";

const createPayloadSchema = z.object({
  url: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireUser();
    const extractions = await listUserExtractions(user.id, 50);

    return NextResponse.json({
      items: extractions,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = createPayloadSchema.parse(await request.json());

    const normalizedUrl = normalizeUrl(body.url).toString();
    await consumeUserQuotaOrThrow(user.id);

    const extraction = await createExtraction(user.id, normalizedUrl);

    try {
      await enqueueExtractionJob({
        extractionId: extraction.id,
        userId: user.id,
        url: normalizedUrl,
      });
    } catch (queueError) {
      throw new ExtractionError(
        "INTERNAL_ERROR",
        `Queue enqueue failed: ${
          queueError instanceof Error ? queueError.message : "Unknown error"
        }`,
        500,
      );
    }

    return NextResponse.json(
      {
        extractionId: extraction.id,
        status: extraction.status,
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
