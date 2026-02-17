import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { captureDesignDna } from "@/lib/extractor/playwright-extractor";
import { enhanceWithOpenAi } from "@/lib/openai-enhance";
import { assertRobotsAllowed } from "@/lib/robots";
import { normalizeUrl, assertPublicTarget } from "@/lib/url-security";

const payloadSchema = z.object({
  url: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = payloadSchema.parse(await request.json());
    const normalized = normalizeUrl(body.url);

    await assertPublicTarget(normalized);
    await assertRobotsAllowed(normalized);

    const capture = await captureDesignDna(normalized.toString());
    const ai = await enhanceWithOpenAi(capture.pack);

    return NextResponse.json({
      status: "completed",
      url: normalized.toString(),
      prompt: ai.prompt,
      summary: ai.summary,
      designBlueprint: ai.designBlueprint,
      starterHtmlCss: ai.starterHtmlCss ?? "",
      pack: capture.pack,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "failed",
        error: error instanceof Error ? error.message : "Extraction failed",
      },
      { status: 400 },
    );
  }
}
