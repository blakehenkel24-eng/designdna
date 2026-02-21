import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { trackEvent } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const body = payloadSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase.auth.updateUser({
      password: body.password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await trackEvent("auth_password_reset_succeeded", {
      userId: user.id,
    });

    return NextResponse.json({
      ok: true,
      message: "Password updated. Redirecting...",
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
