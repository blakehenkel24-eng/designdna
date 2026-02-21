import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_NEXT_PATH, sanitizeNextPath } from "@/lib/auth-resume";
import { resolveAppOrigin } from "@/lib/app-origin";
import { trackEvent } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  email: z.string().email(),
  next_path: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const appOrigin = resolveAppOrigin(request);
    const body = payloadSchema.parse(await request.json());
    const nextPath = sanitizeNextPath(body.next_path ?? DEFAULT_NEXT_PATH);
    const resetPath = `/login/reset-password?next=${encodeURIComponent(nextPath)}`;
    const callbackUrl = `${appOrigin}/auth/callback?next=${encodeURIComponent(resetPath)}`;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(body.email, {
      redirectTo: callbackUrl,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await trackEvent("auth_password_reset_requested", {
      payload: {
        next_path: nextPath,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Password reset email sent. Check inbox and spam folder.",
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
