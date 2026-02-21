import { ResetPasswordForm } from "@/app/login/reset-password/ResetPasswordForm";
import styles from "@/app/login/reset-password/reset-password.module.css";
import { sanitizeNextPath } from "@/lib/auth-resume";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = sanitizeNextPath(params.next);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Reset link expired</h1>
          <p className={styles.subtitle}>
            This password reset session is missing or expired. Request a new reset email from
            login.
          </p>
          <a
            className={styles.secondaryAction}
            href={`/login?next=${encodeURIComponent(nextPath)}`}
          >
            Back to login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <ResetPasswordForm email={user.email ?? ""} nextPath={nextPath} />
    </main>
  );
}
