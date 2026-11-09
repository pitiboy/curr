#!/usr/bin/env bash
# main frissítése és merge az aktuális branchre (régi mm alias).
# Futó Strapi dev közben is: stash + checkout -f a generált fájlokra.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RESET="$ROOT/scripts/reset-strapi-generated-git.sh"

STRAPI_GENERATED_FILES=(
  types/generated/contentTypes.d.ts
  types/generated/components.d.ts
  src/extensions/documentation/documentation/1.0.0/full_documentation.json
)

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
