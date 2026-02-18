import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getHistoryItemForExport, trackEvent } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  analysis_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await trackEvent("json_download_clicked", {
      payload: { user: "anonymous", allowed: false },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = payloadSchema.parse(await request.json());
    const history = await getHistoryItemForExport(user, body.analysis_id);

    if (!history.entitlement.can_export_json) {
      await trackEvent("paywall_viewed", {
        userId: user.id,
        payload: { location: "json_download" },
      });
      await trackEvent("json_download_clicked", {
        userId: user.id,
        payload: { allowed: false, plan: history.entitlement.plan },
      });

      return NextResponse.json(
        {
          error: "JSON export is a Pro feature.",
          code: "PRO_REQUIRED_JSON_EXPORT",
        },
        { status: 402 },
      );
    }

    if (!history.item) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    await trackEvent("json_download_clicked", {
      userId: user.id,
      payload: { allowed: true, plan: history.entitlement.plan },
    });

    return NextResponse.json({
      analysis_id: history.item.id,
      source_url: history.item.source_url,
      created_at: history.item.created_at,
      export_json: history.item.export_payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 },
    );
  }
}
