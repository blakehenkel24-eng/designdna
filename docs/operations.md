# Operations Guide

## Local Development

1. Install dependencies:
   - `npm install`
2. Configure environment:
   - `cp .env.example .env.local`
3. Start app:
   - `npm run dev`

Default local URL: `http://localhost:3000`.

## Command Reference

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint checks |
| `npm run typecheck` | TypeScript no-emit check |
| `npm run test` | Vitest test run |
| `npm run test:watch` | Vitest watch mode |
| `npm run worker` | Start Redis-backed extraction worker |
| `npm run cleanup:expired` | Run artifact cleanup script manually |

## Background Worker

Use the worker only for queue-style extraction endpoints (`/api/extractions` flow).

1. Ensure Upstash env variables are set.
2. Start worker in a separate terminal:
   - `npm run worker`
3. Submit extraction jobs via `POST /api/extractions`.

## Playwright Runtime Note

For hosted runtimes (for example serverless/container deploys), Chromium must be installed
and resolved from the project directory, not a user cache path.

- `postinstall` already runs a pinned install command:
  - `node scripts/install-playwright.mjs`
- This installs Chromium with `PLAYWRIGHT_BROWSERS_PATH=0`, which is required for
  deploy-time bundling.

## Cleanup Job

Cleanup removes expired artifact files and artifact rows.

- Manual:
  - `npm run cleanup:expired`
- HTTP cron:
  - `POST /api/cron/cleanup`
  - Send `x-cron-secret: <CRON_CLEANUP_SECRET>` or `Authorization: Bearer <CRON_CLEANUP_SECRET>`

Recommended schedule: at least hourly in production.

## Benchmark Snapshot Writing

Endpoint: `POST /api/benchmark/snapshot`.

Behavior:

- Disabled when `NODE_ENV=production`.
- Writes `stitchPrompt.txt`, `tokens.json`, and `score.json` under `test/regression/<slug>/`.
- Can resolve values from `analysis_history` when `analysis_id` is supplied.

## Regression Harness Folder Hygiene

- Keep regression snapshots under `test/regression/<slug>/`.
- Use lowercase URL-derived slugs where possible (the benchmark endpoint already slugifies inputs).
- Use `test/regression/root-snapshot/` only for legacy baseline files moved from repo root.

## Pre-Release Checks

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. Verify key routes:
   - `/api/analyze`
   - `/api/me/entitlements`
   - `/api/history`
   - `/api/export/json`
   - `/api/cron/cleanup` (with secret)
