#!/usr/bin/env bash
# Lokális Strapi generált fájlok + git skip-worktree (merge/pull/git-mm).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STRAPI_GENERATED_FILES=(
  types/generated/contentTypes.d.ts
  types/generated/components.d.ts
  src/extensions/documentation/documentation/1.0.0/full_documentation.json
)

STASH_MESSAGE='strapi-generated (git-mm)'

skip_off() {
  for f in "${STRAPI_GENERATED_FILES[@]}"; do
    git update-index --no-skip-worktree "$f" 2>/dev/null || true
  done
}

skip_on() {
  for f in "${STRAPI_GENERATED_FILES[@]}"; do
    git update-index --skip-worktree "$f" 2>/dev/null || true
  done
}

restore_from_head() {
  git restore --worktree --source=HEAD -- "${STRAPI_GENERATED_FILES[@]}"
}

prep_for_git_ops() {
  skip_off
  restore_from_head
}

stash_generated_if_dirty() {
  prep_for_git_ops
  local dirty=false
  for f in "${STRAPI_GENERATED_FILES[@]}"; do
    if ! git diff --quiet HEAD -- "$f"; then
      dirty=true
      break
    fi
  done
  if [[ "$dirty" == true ]]; then
    git stash push --quiet -m "$STASH_MESSAGE" -- "${STRAPI_GENERATED_FILES[@]}"
    echo "stash"
    return 0
  fi
  return 1
}

drop_generated_stash_if_any() {
  local found=false
  local i=0
  while git stash list | grep -qF "$STASH_MESSAGE"; do
    local ref
    ref="$(git stash list | grep -F "$STASH_MESSAGE" | head -1 | cut -d: -f1)"
    git stash drop "$ref"
    found=true
    i=$((i + 1))
    if [[ "$i" -gt 5 ]]; then
      echo "reset-strapi-generated: túl sok egyező stash" >&2
      exit 1
    fi
  done
  [[ "$found" == true ]]
}

usage() {
  echo "Usage: $0 [reset|prep|skip-on|skip-off|stash-if-dirty|drop-stash]" >&2
  echo "  reset          — prep + skip-on (napi reset / status zaj)" >&2
  echo "  prep           — skip off + restore HEAD (git-mm közepén)" >&2
  echo "  stash-if-dirty — prep, ha még diff → git stash (futó dev zaj)" >&2
  echo "  drop-stash     — git-mm végén: eldobja a generált stash-t (pop nélkül)" >&2
}

MODE="${1:-reset}"

case "$MODE" in
  reset)
    prep_for_git_ops
    skip_on
    ;;
  prep)
    prep_for_git_ops
    ;;
  skip-on)
    skip_on
    ;;
  skip-off)
    skip_off
    ;;
  stash-if-dirty)
    stash_generated_if_dirty || true
    ;;
  drop-stash)
    drop_generated_stash_if_any || true
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
