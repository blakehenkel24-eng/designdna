import { NextRequest, NextResponse } from "next/server";

import { listHistoryForUser, trackEvent } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? undefined;

  try {
    const history = await listHistoryForUser(user, query);

    return NextResponse.json({
      items: history.items,
      entitlement: {
        plan: history.entitlement.plan,
        can_view_history: history.entitlement.can_view_history,
      },
    });
  } catch (error) {
    await trackEvent("analysis_failed", {
      userId: user.id,
      payload: { endpoint: "history", error: error instanceof Error ? error.message : "unknown" },
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load history",
      },
      { status: 500 },
    );
  }
}
