import { ExtractionError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ExtractionError("UNAUTHORIZED", "Unauthorized", 401);
  }

  return user;
}
