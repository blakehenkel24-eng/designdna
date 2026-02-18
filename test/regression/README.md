# Regression Harness (Scaffold)

This folder is reserved for golden-run snapshots:

- `styleSpec.json`
- `stitchPrompt.txt`
- `tokens.json`

Use `test/fixtures/urls.json` as the stable input set.

Suggested workflow:
1. Run analysis for each URL.
2. Save outputs per URL slug in this directory.
3. Diff snapshots when extractor/prompt logic changes.
