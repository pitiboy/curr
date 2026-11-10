#!/usr/bin/env bash
# Register temp dirs and credential files for secure removal on exit.
set -euo pipefail

BACKUP_CLEANUP_PATHS=()

backup_register_cleanup() {
  local path="$1"
  BACKUP_CLEANUP_PATHS+=("$path")
}

backup_cleanup() {
  local p
  for p in "${BACKUP_CLEANUP_PATHS[@]}"; do
  [[ -n "$p" && -e "$p" ]] || continue
    if [[ -d "$p" ]]; then
      find "$p" -type f -name 'pg_service.conf' -exec shred -u {} + 2>/dev/null || true
      rm -rf "$p"
    elif [[ -f "$p" ]]; then
      shred -u "$p" 2>/dev/null || rm -f "$p"
    fi
  done
  unset NEON_BACKUP_DATABASE_URL || true
}
