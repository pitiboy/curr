#!/usr/bin/env bash
# Strapi generált fájlok: prep → git <args> → skip-on.
# A Cursor SCM UI-t nem fogja el; terminálból / npm run git:safe -- … használható.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export STRAPI_GIT_ROOT="$ROOT"

RESET="$ROOT/scripts/reset-strapi-generated-git.sh"
if [[ ! -f "$RESET" ]]; then
  echo "git-safe: hiányzik $RESET" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <git-subcommand> [args…]" >&2
  echo "  pl. $0 checkout main" >&2
  echo "      $0 switch -c feature" >&2
  echo "      $0 merge main" >&2
  echo "      $0 pull" >&2
  exit 1
fi

bash "$RESET" prep
set +e
git "$@"
ec=$?
set -e
bash "$RESET" skip-on
exit "$ec"
