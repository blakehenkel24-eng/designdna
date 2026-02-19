import { NextResponse } from "next/server";

import { setUserPlan, trackEvent } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await trackEvent("upgrade_started", {
    userId: user.id,
    payload: { target_plan: "PAID" },
  });

  try {
    const entitlement = await setUserPlan(user, "PRO_ACTIVE");

    await trackEvent("upgrade_completed", {
      userId: user.id,
      payload: { plan: entitlement.plan, tier: "PAID" },
    });

    return NextResponse.json({
      message: "Paid plan activated (test mode).",
      entitlement: {
        plan: entitlement.plan,
        used: entitlement.analyses_used_this_period,
        limit: entitlement.analyses_limit_this_period + entitlement.topup_balance,
        remaining: entitlement.remaining_analyses,
        can_export_json: entitlement.can_export_json,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upgrade failed",
      },
      { status: 500 },
    );
  }
}
