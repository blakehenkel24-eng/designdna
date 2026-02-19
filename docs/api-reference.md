# API Reference

All endpoints are implemented with Next.js route handlers under `src/app/api/**/route.ts`.

## Conventions

- Response formats are JSON unless noted.
- Most validation errors return `400`.
- Auth-required routes return `401` when unauthenticated.
- Paid-feature gating commonly uses `402` with explicit error codes.

## Endpoint Inventory

| Endpoint | Method | Auth | Purpose | Key Behavior |
| --- | --- | --- | --- | --- |
| `/api/analyze` | `POST` | Optional | Run full analysis pipeline | Anonymous users limited by `designdna_anon_uses` cookie; includes entitlement payload and optional timing via `x-ddna-debug-timing`. |
| `/api/prototype/extract` | `POST` | Optional | Alias/proxy for `/api/analyze` | Delegates directly to analyze handler. |
| `/api/me/entitlements` | `GET` | Optional | Return current user/guest entitlement state | Returns `ANONYMOUS` plan for guests; returns period bounds for logged-in users. |
| `/api/history` | `GET` | Required | Fetch prior analyses for logged-in user | Supports optional `q` filter against source URL. |
| `/api/export/json` | `POST` | Required | Fetch stored export JSON by analysis id | Blocks non-paid users with `PAID_REQUIRED_JSON_EXPORT`. |
| `/api/topup` | `POST` | Required | Add extra analyses after plan is exhausted | Applies `TOPUP_ANALYSES` when `remaining_analyses <= 0`. |
| `/api/upgrade/pro` | `POST` | Required | Test-mode plan upgrade | Sets plan to `PRO_ACTIVE`. |
| `/api/cron/cleanup` | `POST` | Secret-protected | Remove expired artifacts/files | Requires `x-cron-secret` or Bearer secret matching `CRON_CLEANUP_SECRET`. |
| `/api/extractions` | `GET` | Required | List extraction jobs for user | Uses queue-style extraction records, most recent first. |
| `/api/extractions` | `POST` | Required | Create queued extraction job | Consumes quota RPC, creates extraction row, enqueues Redis job. |
| `/api/extractions/[id]` | `GET` | Required | Fetch one extraction row | Ownership enforced via user-scoped lookup. |
| `/api/extractions/[id]/prompt` | `GET` | Required | Fetch extracted prompt text | Reads `extraction_artifacts.prompt_text`. |
| `/api/extractions/[id]/pack` | `GET` | Required | Fetch extracted pack JSON | Reads `extraction_artifacts.pack_json`. |
| `/api/auth/password` | `POST` | Optional | Email/password login or signup | `mode` is `login` or `signup`; signup may require email verification. |
| `/api/auth/password/resend` | `POST` | Optional | Resend signup verification email | Uses app origin callback + sanitized next path. |
| `/api/auth/oauth/google` | `GET` | Optional | Start Google OAuth flow | Redirects to Supabase OAuth URL; logs auth events. |
| `/api/auth/signout` | `POST` | Required session | Sign out current session | Calls Supabase signOut. |
| `/api/auth/events` | `POST` | Optional | Ingest whitelisted analytics events | Rejects unknown event names. |
| `/api/benchmark/snapshot` | `POST` | Mixed | Save local benchmark snapshot files | Disabled in production; can pull from `analysis_history` by id. |

## Auth and Entitlement Surfaces

- Session lookup for most endpoints: `createSupabaseServerClient()` + `supabase.auth.getUser()`.
- Strict user requirement helper in extraction routes: `requireUser()` from `src/lib/auth.ts`.
- Entitlement logic source: `src/lib/pricing.ts`.
- Guest usage enforcement source: `src/lib/analyze-service.ts` and `/api/me/entitlements`.

## Important Error Codes

- `RATE_LIMITED`: request-level burst limit rejected.
- `INVALID_URL`: URL parsing/validation failure.
- `AUTH_REQUIRED_LOGIN`: anonymous lifetime usage exhausted.
- `PAID_REQUIRED_JSON_EXPORT`: JSON export requested by non-paid plan.
- `TOPUP_NOT_AVAILABLE_YET`: top-up attempted before consuming current allowance.
