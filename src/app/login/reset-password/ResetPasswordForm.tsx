"use client";

import { FormEvent, useState } from "react";

import styles from "@/app/login/reset-password/reset-password.module.css";

type ResetPasswordFormProps = {
  email: string;
  nextPath: string;
};

export function ResetPasswordForm({ email, nextPath }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/password/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not update password.");
      }

      setMessage(payload.message || "Password updated. Redirecting...");
      window.setTimeout(() => {
        window.location.href = nextPath;
      }, 700);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Password reset failed.");
      setLoading(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={onSubmit}>
      <h1 className={styles.title}>Set a new password</h1>
      <p className={styles.subtitle}>
        Resetting password for {email || "your account"}. Use at least 8 characters.
      </p>

      <label className={styles.label} htmlFor="new-password">
        New password
      </label>
      <input
        className={styles.input}
        id="new-password"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="At least 8 characters"
      />

      <label className={styles.label} htmlFor="confirm-new-password">
        Confirm new password
      </label>
      <input
        className={styles.input}
        id="confirm-new-password"
        type="password"
        required
        minLength={8}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="Re-enter password"
      />

      <button className={styles.primaryAction} type="submit" disabled={loading}>
        {loading ? "Updating password..." : "Update password"}
      </button>
      {message ? <p className={styles.success}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </form>
  );
}
