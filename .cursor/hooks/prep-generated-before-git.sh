#!/usr/bin/env bash
# Cursor beforeShellExecution: git checkout/switch/merge/pull/rebase előtt prep.
# A Cursor SCM UI git hívását nem kapja el — csak terminál / agent shell.
set -euo pipefail

input="$(cat)"
command="$(
  printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("command") or "")' 2>/dev/null || true
)"

should_prep=0
case "$command" in
  *git\ checkout* | *git\ switch* | *git\ merge* | *git\ pull* | *git\ rebase*)
    should_prep=1
    ;;
esac

if [[ "$should_prep" -eq 1 ]]; then
  ROOT="${CURSOR_PROJECT_DIR:-}"
  if [[ -z "$ROOT" ]]; then
    ROOT="$(pwd)"
  fi
  RESET="$ROOT/scripts/reset-strapi-generated-git.sh"
  if [[ -x "$RESET" || -f "$RESET" ]]; then
    STRAPI_GIT_ROOT="$ROOT" bash "$RESET" prep >/dev/null 2>&1 || true
  fi
fi

printf '%s\n' '{ "permission": "allow" }'
exit 0
