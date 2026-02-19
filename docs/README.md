# DesignDNA Documentation

This folder is the source of truth for how the project is wired, how data moves through it, and how to operate it safely.

## Read Order

1. `docs/architecture.md` for runtime flows and system boundaries.
2. `docs/configuration.md` for environment variables and defaults.
3. `docs/api-reference.md` for endpoint-level behavior.
4. `docs/data-model.md` for Supabase tables, policies, and migration intent.
5. `docs/operations.md` for runbooks (dev, worker, cleanup, release checks).
6. `docs/repository-map.md` for folder and file ownership.

## Maintenance Rules

1. Update docs in the same change whenever behavior changes in:
   - `src/app/api/**`
   - `src/lib/**`
   - `supabase/migrations/**`
   - `.env.example` or env parsing code
2. Keep route names, plan limits, and env defaults exactly aligned with code.
3. Treat this folder as production documentation, not notes.
4. Run `npm run docs:check` before opening a PR.

## Enforcement

- Local check: `npm run docs:check`
- CI check: `.github/workflows/docs-sync.yml` enforces the same rule on pull requests.
