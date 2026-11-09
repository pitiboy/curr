#!/usr/bin/env bash
# Lokális Strapi generált fájlok visszaállítása HEAD-re (merge/pull/rebase előtt).
# skip-worktree mellett a git status csendes, de checkout/merge továbbra is blokkol,
# ha a develop újraírta a fájlt.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FILES=(
  types/generated/contentTypes.d.ts
  types/generated/components.d.ts
  src/extensions/documentation/documentation/1.0.0/full_documentation.json
)

skip_off() {
  for f in "${FILES[@]}"; do
    git update-index --no-skip-worktree "$f" 2>/dev/null || true
  done
}

skip_on() {
  for f in "${FILES[@]}"; do
    git update-index --skip-worktree "$f" 2>/dev/null || true
  done
}

usage() {
  echo "Usage: $0 [reset|skip-on|skip-off]" >&2
  echo "  reset    — no-skip, restore worktree from HEAD, skip-on (default)" >&2
  echo "  skip-on  — csak --skip-worktree be" >&2
  echo "  skip-off — csak --no-skip-worktree (commit előtt)" >&2
}

MODE="${1:-reset}"

case "$MODE" in
  reset)
    skip_off
    git restore --worktree --source=HEAD -- "${FILES[@]}"
    skip_on
  ;;
  skip-on)
    skip_on
    ;;
  skip-off)
    skip_off
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    usage
    exit 1
    ;;
esac
