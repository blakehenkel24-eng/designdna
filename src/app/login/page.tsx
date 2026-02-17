import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/LoginForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="page-shell centered">
      <LoginForm />
    </main>
  );
}
