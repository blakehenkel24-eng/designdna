import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { trackEvent } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedEvents = new Set([
  "paywall_login_clicked",
  "auth_magic_link_sent",
  "auth_resume_started",
  "auth_resume_succeeded",
  "auth_resume_failed",
]);

const payloadSchema = z.object({
  event_name: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = payloadSchema.parse(await request.json());

    if (!allowedEvents.has(body.event_name)) {
      return NextResponse.json({ error: "Event not allowed" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await trackEvent(body.event_name, {
      userId: user?.id,
      payload: body.payload ?? {},
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid event payload",
      },
      { status: 400 },
    );
  }
}
