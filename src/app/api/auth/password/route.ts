import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_NEXT_PATH, sanitizeNextPath } from "@/lib/auth-resume";
import { resolveAppOrigin } from "@/lib/app-origin";
import { trackEvent } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  mode: z.enum(["login", "signup"]),
  email: z.string().email(),
  password: z.string().min(8),
  next_path: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const appOrigin = resolveAppOrigin(request);
    const body = payloadSchema.parse(await request.json());
    const nextPath = sanitizeNextPath(body.next_path ?? DEFAULT_NEXT_PATH);
    const callbackUrl = `${appOrigin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const supabase = await createSupabaseServerClient();

    if (body.mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });

      if (error) {
        const lowerMessage = error.message.toLowerCase();
        const normalizedMessage = lowerMessage.includes("invalid login credentials")
          ? "Invalid email or password. If you just signed up, check your email and confirm your account first."
          : error.message;

        await trackEvent("auth_resume_failed", {
          payload: {
            action_type: "login",
            reason: normalizedMessage,
          },
        });

        return NextResponse.json(
          {
            error: normalizedMessage,
            can_resend_verification: lowerMessage.includes("invalid login credentials"),
          },
          { status: 401 },
        );
      }

      await trackEvent("auth_resume_succeeded", {
        userId: data.user?.id,
        payload: {
          action_type: "login",
        },
      });

      return NextResponse.json({
        ok: true,
        logged_in: true,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const requiresEmailConfirmation = !data.session;

    await trackEvent("auth_signup_submitted", {
      userId: data.user?.id,
      payload: {
        mode: "signup",
        requires_email_confirmation: requiresEmailConfirmation,
        next_path: nextPath,
      },
    });

    return NextResponse.json({
      ok: true,
      logged_in: Boolean(data.session),
      pending_verification: requiresEmailConfirmation,
      requires_email_confirmation: requiresEmailConfirmation,
      message: requiresEmailConfirmation
        ? "Account created. Check your email to verify your account before logging in."
        : "Account created and logged in.",
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
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
