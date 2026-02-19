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
    const callbackUrl = `${appOrigin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: body.email,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await trackEvent("auth_verification_resent", {
      payload: {
        next_path: nextPath,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Verification email resent. Check inbox and spam folder.",
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
