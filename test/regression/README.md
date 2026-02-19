# Regression Harness

This folder stores golden snapshots for repeatability checks.

## Snapshot Files Per Target

- `stitchPrompt.txt`
- `tokens.json`
- `score.json`

## Folder Convention

- Use `test/regression/<slug>/` where `<slug>` is URL-derived lowercase kebab case.
- Keep one folder per target URL.
- Avoid spaces/trailing spaces in folder names.
- `test/regression/root-snapshot/` is reserved for legacy baseline files moved from project root.

## Inputs

- Stable source list: `test/fixtures/urls.json`

## Suggested Workflow

1. Run analysis for each URL.
2. Save outputs under the URL slug folder in this directory.
3. Diff snapshots when extractor/prompt logic changes.
