# DesignDNA

DesignDNA is a Next.js web app that extracts a public page's structure and visual language into:

- A deterministic LLM-ready prompt for semantic HTML + CSS recreation
- A structured `design_dna_pack_v1` JSON artifact

It uses:

- Next.js App Router (web app + API routes)
- Supabase (Auth, Postgres, Storage)
- Upstash Redis (job queue)
- Playwright worker (capture pipeline)

## MVP capabilities

- Email magic-link sign-in
- Single-page URL extraction
- Async job queue with status polling
- Compliance checks: protocol allowlist, SSRF guard, robots policy
- Login-wall detection for unsupported protected pages
- DOM/CSS extraction + screenshot color analysis
- Artifact TTL cleanup (default 24h)
- Free-tier daily cap (default 10)

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
- Create storage bucket `captures` (private)

4. Configure Upstash Redis and set env vars.

5. Start app + worker in two terminals:

```bash
npm run dev
npm run worker
```

6. Open `http://localhost:3000`.

## API

- `POST /api/extractions` body `{ "url": "https://example.com" }`
- `GET /api/extractions`
- `GET /api/extractions/:id`
- `GET /api/extractions/:id/prompt`
- `GET /api/extractions/:id/pack`
- `POST /api/cron/cleanup` header `x-cron-secret: <CRON_CLEANUP_SECRET>`

## Worker

Worker entrypoint:

- `src/worker/index.ts`

Pipeline orchestration:

- `src/lib/worker.ts`

Playwright extraction:

- `src/lib/extractor/playwright-extractor.ts`

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
