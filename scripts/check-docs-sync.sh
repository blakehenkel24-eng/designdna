#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${1:-HEAD}"

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "Base ref '$BASE_REF' was not found."
  exit 2
fi

if [[ "$BASE_REF" == "HEAD" ]]; then
  TRACKED_CHANGED="$(git diff --name-only --diff-filter=ACMRTUXB HEAD)"
else
  TRACKED_CHANGED="$(git diff --name-only --diff-filter=ACMRTUXB "${BASE_REF}...HEAD")"
fi

UNTRACKED_CHANGED="$(git ls-files --others --exclude-standard)"

ALL_CHANGED="$(printf "%s\n%s\n" "$TRACKED_CHANGED" "$UNTRACKED_CHANGED" | sed '/^$/d' | sort -u)"

if [[ -z "$ALL_CHANGED" ]]; then
  echo "Docs sync check passed: no file changes detected."
  exit 0
fi

requires_docs_update=false
has_docs_update=false

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  case "$file" in
    docs/*|README.md)
      has_docs_update=true
      ;;
  esac

  case "$file" in
    src/app/api/*|src/lib/*|supabase/migrations/*|.env.example)
      requires_docs_update=true
      ;;
  esac
done <<< "$ALL_CHANGED"

if [[ "$requires_docs_update" == "false" ]]; then
  echo "Docs sync check passed: no docs-required paths changed."
  exit 0
fi

if [[ "$has_docs_update" == "true" ]]; then
  echo "Docs sync check passed: docs were updated with code changes."
  exit 0
fi

echo "Docs sync check failed."
echo ""
echo "You changed files in one or more docs-required paths:"
echo "$ALL_CHANGED" | sed 's/^/  - /'
echo ""
echo "Add at least one documentation update in:"
echo "  - docs/*"
echo "  - README.md"
exit 1
