import { NextResponse } from "next/server";

import { getOrCreateEntitlementForUser } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FREE_LIMIT = 3;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      logged_in: false,
      entitlement: {
        plan: "LOGIN_REQUIRED",
        used: 0,
        limit: FREE_LIMIT,
        remaining: FREE_LIMIT,
        can_export_json: false,
        can_view_history: false,
      },
    });
  }

  try {
    const entitlement = await getOrCreateEntitlementForUser(user);
    const displayName =
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
      (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
      user.email?.split("@")[0] ||
      "Member";

    return NextResponse.json({
      logged_in: true,
      user: {
        id: user.id,
        name: displayName,
        contact: user.email ?? "",
      },
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
