import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { runAnalysis } from "@/lib/analyze-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  url: z.string().min(1),
});

function clientIdentifier(request: NextRequest, userId?: string) {
  if (userId) return `user:${userId}`;

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = payloadSchema.parse(await request.json());

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const anonymousUses = Number(request.cookies.get("designdna_anon_uses")?.value ?? "0");

    const result = await runAnalysis({
      rawUrl: body.url,
      user,
      anonymousUses,
      rateLimitId: clientIdentifier(request, user?.id),
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          status: "failed",
          code: result.code,
          error: result.message,
          entitlement: result.entitlement,
        },
        { status: result.status },
      );
    }

    const response = NextResponse.json({
      status: "completed",
      source_url: result.sourceUrl,
      url: result.sourceUrl,
      summary: result.summary,
      prompt: result.prompt,
      design_blueprint: result.designBlueprint,
      designBlueprint: result.designBlueprint,
      preview: result.preview,
      export_json: result.entitlement.canExportJson ? result.exportJson : null,
      pack: null,
      history_id: result.historyId,
      entitlement: result.entitlement,
      capabilities: {
        json_download_enabled: result.entitlement.canExportJson,
        history_enabled: result.entitlement.canExportJson,
      },
    });

    if (!user) {
      response.cookies.set("designdna_anon_uses", String(result.anonymousUsesConsumed), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        status: "failed",
        code: "INVALID_REQUEST",
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 },
    );
  }
}
