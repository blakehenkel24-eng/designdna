# Configuration

Environment configuration is split between strict validated server/public config and optional tuning flags.

## Validated by `src/lib/env.ts`

These values are parsed with zod and will throw at runtime if invalid/missing.

| Variable | Required | Default | Used By |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | None | Browser/server Supabase clients, proxy middleware |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | None | Browser/server Supabase clients, proxy middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | None | Admin Supabase client for privileged DB/storage writes |
| `UPSTASH_REDIS_REST_URL` | Yes | None | Rate limiter and extraction queue client |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | None | Rate limiter and extraction queue client |
| `EXTRACTION_DAILY_CAP` | No | `10` | Queue-style extraction quota RPC cap |
| `ARTIFACT_TTL_HOURS` | No | `24` | Expiration timestamp for extraction artifacts |
| `CRON_CLEANUP_SECRET` | Yes | None | `/api/cron/cleanup` authorization |

## Additional Runtime Variables

These are read directly via `process.env` in specific modules.

| Variable | Required | Default | Used By |
| --- | --- | --- | --- |
| `APP_ORIGIN` | Recommended | Derived from request origin | OAuth callback/base URL construction (`src/lib/app-origin.ts`) |
| `LLM_API_KEY` | Optional | None | LLM enhancement authentication |
| `OPENAI_API_KEY` | Optional | None | Backward-compatible fallback key |
| `LLM_API_BASE_URL` | Optional | `https://api.openai.com/v1` | Chat completions base URL |
| `LLM_MODEL` | Optional | `gpt-4.1-mini` | Primary LLM model selection |
| `OPENAI_MODEL` | Optional | None | Backward-compatible fallback model |
| `LLM_INCLUDE_STARTER_HTML` | Optional | `false` | Include starter scaffold in LLM response |
| `LLM_CHAT_TEMPLATE_THINKING` | Optional | `false` | Pass `chat_template_kwargs.thinking` flag |
| `ANALYZE_FAST_MODE_ENABLED` | Optional | `false` | Enable fast capture timing profile |
| `ANALYZE_NAV_TIMEOUT_MS` | Optional | Mode-specific | Navigation timeout override |
| `ANALYZE_NAV_FALLBACK_TIMEOUT_MS` | Optional | Mode-specific | Fallback navigation timeout override |
| `ANALYZE_NETWORK_IDLE_WAIT_MS` | Optional | Mode-specific | Network-idle wait override |
| `ANALYZE_CAPTURE_SETTLE_MS` | Optional | Mode-specific | Post-nav settle delay override |
| `ANALYZE_SCREENSHOT_TIMEOUT_MS` | Optional | Mode-specific | Screenshot timeout override |
| `ANALYZE_SCREENSHOT_FALLBACK_TIMEOUT_MS` | Optional | Mode-specific | Fallback screenshot timeout override |
| `ANALYZE_LLM_TIMEOUT_MS` | Optional | `40000` | Timeout per LLM request attempt |
| `ANALYZE_LLM_MAX_ATTEMPTS` | Optional | `2` (capped to 2) | Strict + repair attempt limit |
| `NODE_ENV` | Runtime | framework-managed | Disables benchmark snapshot writes in production |

Mode-specific capture defaults:

- Legacy mode: nav `35000`, fallback nav `15000`, idle `8000`, settle `1200`, screenshot `20000`, fallback screenshot `10000`.
- Fast mode: nav `20000`, fallback nav `8000`, idle `2500`, settle `500`, screenshot `8000`, fallback screenshot `4000`.

## Setup Baseline

1. Copy `.env.example` to `.env.local`.
2. Fill required Supabase and Upstash values.
3. Set `APP_ORIGIN` in production.
4. Add one LLM key (`LLM_API_KEY` recommended) to enable model enhancement.
5. Leave tuning variables unset unless profiling or debugging performance.

## Secrets Handling

- Do not commit `.env.local`.
- Keep service-role keys and cron secrets server-side only.
- Rotate `CRON_CLEANUP_SECRET` if exposed and update scheduler immediately.
