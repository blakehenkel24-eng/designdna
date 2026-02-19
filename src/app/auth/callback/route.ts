import { NextResponse } from "next/server";

import { appendAuthSuccessFlag, sanitizeNextPath } from "@/lib/auth-resume";
import { resolveAppOrigin } from "@/lib/app-origin";
import { trackEvent } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const appOrigin = resolveAppOrigin(request);
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const failurePath = `/login?error=auth_callback_failed&next=${encodeURIComponent(nextPath)}`;

  if (!code) {
    await trackEvent("auth_callback_failed", {
      payload: {
        reason: "missing_code",
        next_path: nextPath,
      },
    });
    return NextResponse.redirect(
      new URL(failurePath, appOrigin),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    await trackEvent("auth_callback_failed", {
      payload: {
        reason: "exchange_failed",
        next_path: nextPath,
      },
    });
    return NextResponse.redirect(
      new URL(failurePath, appOrigin),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await trackEvent("auth_callback_succeeded", {
    userId: user?.id,
    payload: {
      next_path: nextPath,
    },
  });

  return NextResponse.redirect(
    new URL(appendAuthSuccessFlag(nextPath), appOrigin),
  );
}
