# Repository Map

This map defines what each top-level area is for and where new code should go.

## Top-Level

| Path | Purpose |
| --- | --- |
| `src/` | Application source code (UI, APIs, libs, worker, scripts). |
| `assets/` | Non-runtime source assets kept for design/archive organization. |
| `public/` | Static pages and assets served directly by Next.js. |
| `supabase/` | SQL migrations for schema and policy management. |
| `test/` | Fixtures and regression snapshots. |
| `docs/` | Project documentation (architecture, API, config, operations). |
| `.env.example` | Template environment file for local setup. |
| `README.md` | Quick-start and high-level overview. |
| `package.json` | Scripts and dependencies. |
| `vercel.json` | Vercel runtime configuration. |

## `src/` Breakdown

| Path | Purpose |
| --- | --- |
| `src/app/` | App Router pages and API route handlers. |
| `src/app/api/` | HTTP API endpoints. |
| `src/lib/` | Domain logic, integrations, security, pricing, extraction pipeline. |
| `src/lib/extractor/` | Playwright capture + style extraction pipeline. |
| `src/lib/schema/` | Runtime schemas for extracted/enhanced payloads. |
| `src/lib/supabase/` | Browser/server/admin Supabase clients. |
| `src/lib/__tests__/` | Unit tests for core logic. |
| `src/scripts/` | Standalone operational scripts. |
| `src/worker/` | Worker process entrypoint for queued extraction jobs. |
| `src/types/` | Shared generated/manual type declarations. |
| `src/proxy.ts` | Request proxy/middleware integration with Supabase SSR auth. |

## `public/` Breakdown

| Path | Purpose |
| --- | --- |
| `public/designdna-exact.html` | Main static app shell currently used as landing runtime target. |
| `public/about.html` | About/policy page. |
| `public/documentation.html` | Static user-facing "how it works" page. |
| `public/pricing.html` | Pricing and upgrade funnel page. |
| `public/branding/` | Canonical branding assets and logo variants. |
| `public/mockups/` | Design experiments/reference mockups (not runtime logic). |

## `assets/` Breakdown

| Path | Purpose |
| --- | --- |
| `assets/branding-source/` | Archived/non-runtime logo source files moved out of repo root. |

## `test/` Breakdown

| Path | Purpose |
| --- | --- |
| `test/fixtures/urls.json` | Stable URL list for repeatable regression runs. |
| `test/regression/` | Snapshot outputs (`stitchPrompt.txt`, `tokens.json`, `score.json`) by slug. |
| `test/regression/root-snapshot/` | Legacy baseline snapshot files moved out of repo root. |
| `test/regression/README.md` | Snapshot harness usage notes. |

## Organization Rules

1. Put new runtime docs in `docs/`, not in root.
2. Keep generated or temporary artifacts out of git-tracked paths.
3. Keep benchmark outputs under `test/regression/<slug>/`.
4. Keep static marketing assets under `public/branding` or `public/mockups` depending on runtime usage.
5. Keep business logic in `src/lib/` and keep route handlers thin.
