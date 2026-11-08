#!/usr/bin/env bash
# Validate required GitHub Actions secrets/variables before backup jobs run.
set -euo pipefail

sanitize_err() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  "$script_dir/sanitize-log.sh"
}

fail() {
  echo "$1" >&2 | sanitize_err
  exit 1
}

recipient="${BACKUP_AGE_RECIPIENT:-}"
if [[ -z "$recipient" ]]; then
  fail "BACKUP_AGE_RECIPIENT repository variable is not set."
fi
if [[ "$recipient" != age1* ]]; then
  fail "BACKUP_AGE_RECIPIENT must be an age public recipient (age1...)."
fi

missing=()
for slot in 1 2 3; do
  var="NEON_BACKUP_DATABASE_URL_${slot}"
  val="${!var:-}"
  if [[ -z "$val" ]]; then
    missing+=("$var")
  fi
done

if ((${#missing[@]})); then
  fail "Missing required secrets: ${missing[*]}"
fi

echo "Preflight OK: all three database secrets and BACKUP_AGE_RECIPIENT are configured."
