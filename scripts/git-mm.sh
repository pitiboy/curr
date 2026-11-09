#!/usr/bin/env bash
# main frissítése és merge az aktuális branchre (régi mm alias).
# Futó Strapi dev közben is: stash + checkout -f a generált fájlokra.
# A reset helper /tmp-be másolódik: main-en lehet, hogy még nincs scripts/ a repóban.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export STRAPI_GIT_ROOT="$ROOT"

RESET_SRC="$ROOT/scripts/reset-strapi-generated-git.sh"
if [[ ! -f "$RESET_SRC" ]]; then
  echo "git-mm: hiányzik $RESET_SRC — csak olyan branchről futtasd, ahol megvan." >&2
  exit 1
fi

RESET_CACHE="$(mktemp "${TMPDIR:-/tmp}/curr-reset-strapi-generated.XXXXXX.sh")"
cp "$RESET_SRC" "$RESET_CACHE"
chmod +x "$RESET_CACHE"
RESET="$RESET_CACHE"

STRAPI_GENERATED_FILES=(
  types/generated/contentTypes.d.ts
  types/generated/components.d.ts
  src/extensions/documentation/documentation/1.0.0/full_documentation.json
)

cleanup() {
  local ec=$?
  rm -f "${RESET_CACHE:-}"
  if [[ $ec -ne 0 ]] && [[ -n "${BRANCH:-}" ]] && [[ "$BRANCH" != "main" ]]; then
    if [[ "$(git branch --show-current 2>/dev/null || true)" == "main" ]]; then
      echo "git-mm: megszakadt — vissza: $BRANCH" >&2
      git checkout -f "$BRANCH" || true
    fi
  fi
  return "$ec"
}
trap cleanup EXIT

is_generated_path() {
  local f="$1"
  for g in "${STRAPI_GENERATED_FILES[@]}"; do
    [[ "$f" == "$g" ]] && return 0
  done
  return 1
}

assert_only_generated_or_clean() {
  bash "$RESET" prep
  local f
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if ! is_generated_path "$f"; then
      echo "git-mm: nem generált módosítás: $f — commit/stash előbb." >&2
      git status -sb
      exit 1
    fi
  done < <(git diff --name-only HEAD)
}

clear_generated_for_checkout() {
  bash "$RESET" prep
  bash "$RESET" stash-if-dirty || true
}

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "git-mm: detached HEAD — állj egy branchre." >&2
  exit 1
fi

assert_only_generated_or_clean

if [[ "$BRANCH" == "main" ]]; then
  clear_generated_for_checkout
  git pull -t -f
  bash "$RESET" drop-stash
  bash "$RESET" skip-on
  exit 0
fi

clear_generated_for_checkout
git checkout -f main
git pull -t -f

clear_generated_for_checkout
git checkout -f "$BRANCH"

clear_generated_for_checkout
git merge main

bash "$RESET" drop-stash
bash "$RESET" skip-on
