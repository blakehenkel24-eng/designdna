import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/LoginForm";
import styles from "@/app/login/login-theme.module.css";
import { sanitizeNextPath } from "@/lib/auth-resume";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = sanitizeNextPath(params.next);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <main className={styles.page}>
      <LoginForm nextPath={nextPath} callbackError={params.error ?? null} />
    </main>
  );
}
