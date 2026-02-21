#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN."
  echo "Create one at https://supabase.com/dashboard/account/tokens and export it."
  exit 1
fi

project_ref="${PROJECT_REF:-}"

if [[ -z "$project_ref" && -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
  # Example: https://abc123.supabase.co -> abc123
  project_ref="$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's#https?://([^.]+)\.supabase\.co/?#\1#')"
fi

if [[ -z "$project_ref" ]]; then
  echo "Missing PROJECT_REF."
  echo "Set PROJECT_REF directly, or set NEXT_PUBLIC_SUPABASE_URL so it can be derived."
  exit 1
fi

payload="$(cat <<'JSON'
{
  "mailer_subjects_recovery": "Reset Your Password",
  "mailer_templates_recovery_content": "<h2>Reset Password</h2><p>Follow this link to reset the password for your account:</p><p><a href=\"{{ .ConfirmationURL }}\">Reset Password</a></p><p>If the button does not work, copy and paste this URL:</p><p>{{ .ConfirmationURL }}</p>"
}
JSON
)"

echo "Updating recovery email template for project: $project_ref"
status_code="$(
  curl -sS -o /tmp/supabase-recovery-template-response.json -w "%{http_code}" \
    -X PATCH "https://api.supabase.com/v1/projects/$project_ref/config/auth" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload"
)"

if [[ "$status_code" -lt 200 || "$status_code" -ge 300 ]]; then
  echo "Failed to update template (HTTP $status_code)."
  cat /tmp/supabase-recovery-template-response.json
  exit 1
fi

echo "Done. API response saved to /tmp/supabase-recovery-template-response.json"
