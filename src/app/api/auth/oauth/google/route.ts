import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_NEXT_PATH, sanitizeNextPath } from "@/lib/auth-resume";
import { trackEvent } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const nextPath = sanitizeNextPath(
    request.nextUrl.searchParams.get("next") ?? DEFAULT_NEXT_PATH,
  );

  const redirectTo = `${request.nextUrl.origin}/auth/callback?next=${encodeURIComponent(
    nextPath,
  )}`;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error || !data.url) {
    await trackEvent("auth_google_failed", {
      payload: {
        next_path: nextPath,
        reason: error?.message ?? "missing_oauth_url",
      },
    });

    return NextResponse.redirect(
      new URL(
        `/login?error=google_oauth_failed&next=${encodeURIComponent(nextPath)}`,
        request.url,
      ),
    );
  }

  await trackEvent("auth_google_started", {
    payload: {
      next_path: nextPath,
    },
  });

  return NextResponse.redirect(data.url);
}
