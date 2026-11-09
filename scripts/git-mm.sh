#!/usr/bin/env bash
# main frissítése és merge az aktuális branchre (korábbi `mm` alias).
# Előtte (és merge előtt újra) generált Strapi fájlok = HEAD — skip-worktree + futó dev miatt.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

reset_generated() {
  bash "$ROOT/scripts/reset-strapi-generated-git.sh" reset
}

reset_generated

if [[ -n "$(git status --porcelain --ignore-submodules)" ]]; then
  echo "git-mm: nem üres a working tree (generáltakon kívül). Commit/stash előbb." >&2
  git status -sb
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "git-mm: detached HEAD — állj egy branchre." >&2
  exit 1
fi

if [[ "$BRANCH" == "main" ]]; then
  echo "git-mm: mainen vagy — csak pull." >&2
  git pull -t -f
  exit 0
fi

git checkout main
git pull -t -f
git checkout "$BRANCH"

reset_generated

git merge main
