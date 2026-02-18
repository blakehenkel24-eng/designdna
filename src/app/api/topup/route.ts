import { NextResponse } from "next/server";

import { getOrCreateEntitlementForUser, grantTopup, TOPUP_ANALYSES, trackEvent } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const entitlement = await getOrCreateEntitlementForUser(user);
    if (entitlement.remaining_analyses > 0) {
      return NextResponse.json(
        {
          error: "Top-ups are available after you hit your plan limit.",
          code: "TOPUP_NOT_AVAILABLE_YET",
          remaining: entitlement.remaining_analyses,
        },
        { status: 409 },
      );
    }

    const updated = await grantTopup(user, TOPUP_ANALYSES);

    await trackEvent("topup_purchased", {
      userId: user.id,
      payload: { amount: TOPUP_ANALYSES },
    });

    return NextResponse.json({
      entitlement: {
        plan: updated.plan,
        used: updated.analyses_used_this_period,
        limit: updated.analyses_limit_this_period + updated.topup_balance,
        remaining: updated.remaining_analyses,
      },
      message: `Top-up applied: +${TOPUP_ANALYSES} analyses.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Top-up failed",
      },
      { status: 500 },
    );
  }
}
