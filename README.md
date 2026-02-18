# DesignDNA

DesignDNA is a Next.js web app that extracts a public page's structure and visual language into:

- An LLM-ready prompt for semantic HTML + CSS recreation
- A preview payload for in-app cards (colors, typography, effects, structure)
- A versioned export JSON schema (`schema_version: "1.0"`)

It uses:

- Next.js App Router (web app + API routes)
- Supabase (Auth, Postgres, Storage)
- Upstash Redis (rate limiting)
- Playwright capture pipeline

## MVP capabilities

- Email magic-link sign-in
- Single-page URL extraction
- Compliance checks: protocol allowlist, SSRF guard, robots policy
- DOM/CSS extraction + screenshot color analysis
- Pricing/entitlements:
  - Free: 3 analyses/month (preview only)
  - Pro: 60 analyses/month (JSON export + history)
  - Top-up: +40 analyses
- Server-side usage metering with monthly reset
- Pro-only JSON export endpoint and limited/free history handling

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env.local
```

3. Create a Supabase project and configure:

- Auth email provider enabled
- Run migration in `supabase/migrations/20260216233000_init_designdna.sql`
- Run migration in `supabase/migrations/20260217195000_pricing_entitlements.sql`
- Create storage bucket `captures` (private)

4. Configure Upstash Redis and set env vars.

5. Start app:

```bash
npm run dev
```

6. Open `http://localhost:3000`.

## API

- `POST /api/analyze` body `{ "url": "https://example.com" }`
- `GET /api/me/entitlements`
- `GET /api/history?q=<optional-url-query>`
- `POST /api/export/json` body `{ "analysis_id": "<uuid>" }` (Pro-only)
- `POST /api/topup` (+40 analyses after plan limit)
- `POST /api/upgrade/pro` (test-mode Pro activation)
- `POST /api/cron/cleanup` header `x-cron-secret: <CRON_CLEANUP_SECRET>`

## Cleanup

Artifacts are deleted by TTL while extraction metadata remains. You can run manual cleanup:

```bash
npm run cleanup:expired
```

For production, configure a scheduled job to call:

- `POST /api/cron/cleanup`

## Tests

```bash
npm run test
npm run lint
npm run typecheck
```
