import { NextRequest, NextResponse } from "next/server";

import { getOrCreateEntitlementForUser } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ANON_LIMIT = 3;

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const used = Number(request.cookies.get("designdna_anon_uses")?.value ?? "0");
    return NextResponse.json({
      logged_in: false,
      entitlement: {
        plan: "FREE_TRIAL",
        used,
        limit: ANON_LIMIT,
        remaining: Math.max(0, ANON_LIMIT - used),
        can_export_json: false,
        can_view_history: false,
      },
    });
  }

  try {
    const entitlement = await getOrCreateEntitlementForUser(user);
    return NextResponse.json({
      logged_in: true,
      entitlement: {
        plan: entitlement.plan,
        used: entitlement.analyses_used_this_period,
        limit: entitlement.analyses_limit_this_period + entitlement.topup_balance,
        remaining: entitlement.remaining_analyses,
        can_export_json: entitlement.can_export_json,
        can_view_history: entitlement.can_view_history,
        period_start: entitlement.period_start,
        period_end: entitlement.period_end,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load entitlements",
      },
      { status: 500 },
    );
  }
}
