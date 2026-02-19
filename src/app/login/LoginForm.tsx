"use client";

import { FormEvent, useState } from "react";

type LoginFormProps = {
  nextPath: string;
  callbackError?: string | null;
};

type AuthMode = "login" | "signup";

export function LoginForm({ nextPath, callbackError }: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authErrorMessage =
    callbackError === "auth_callback_failed"
      ? "Previous auth callback failed. Please try again."
      : callbackError === "google_oauth_failed"
        ? "Google sign-in failed. Please try again or use email + password."
        : null;

  async function resendVerificationEmail() {
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }

    setResendLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/password/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          next_path: nextPath,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not resend verification email.");
      }

      setMessage(payload.message || "Verification email resent.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Resend failed.");
    } finally {
      setResendLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    setCanResendVerification(false);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          email,
          password,
          next_path: nextPath,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        logged_in?: boolean;
        pending_verification?: boolean;
        requires_email_confirmation?: boolean;
        can_resend_verification?: boolean;
        message?: string;
      };

      if (!response.ok) {
        if (payload.can_resend_verification) {
          setCanResendVerification(true);
        }
        throw new Error(payload.error || "Authentication failed.");
      }

      if (payload.requires_email_confirmation || payload.pending_verification) {
        setCanResendVerification(true);
        setMessage(
          payload.message ||
            "Account created. Check your email to confirm before logging in.",
        );
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setLoading(false);
        return;
      }

      window.location.href = nextPath;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
      setLoading(false);
    }
  }

  return (
    <form className="card login-card" onSubmit={onSubmit}>
      <h1>{mode === "login" ? "Log in to DesignDNA" : "Create your DesignDNA account"}</h1>
      <p className="muted">
        Use email + password, or continue with Google.
      </p>
      {authErrorMessage ? <p className="error">{authErrorMessage}</p> : null}

      <a
        className="secondary-button"
        href={`/api/auth/oauth/google?next=${encodeURIComponent(nextPath)}`}
      >
        Continue with Google
      </a>

      <div className="hero-actions" style={{ justifyContent: "flex-start" }}>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setMode("login");
            setMessage(null);
            setError(null);
          }}
          disabled={loading}
        >
          Log In
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setMode("signup");
            setMessage(null);
            setError(null);
          }}
          disabled={loading}
        >
          Sign Up
        </button>
      </div>

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="At least 8 characters"
      />

      {mode === "signup" ? (
        <>
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter password"
          />
        </>
      ) : null}

      <button type="submit" disabled={loading}>
        {loading
          ? mode === "login"
            ? "Logging in..."
            : "Creating account..."
          : mode === "login"
            ? "Log In"
            : "Create Account"}
      </button>

      <p className="muted" style={{ fontSize: "0.85rem" }}>
        After authentication you will return to your current workflow.
      </p>
      {canResendVerification ? (
        <button
          type="button"
          className="secondary-button"
          onClick={() => void resendVerificationEmail()}
          disabled={resendLoading || loading}
        >
          {resendLoading ? "Resending..." : "Resend verification email"}
        </button>
      ) : null}
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
