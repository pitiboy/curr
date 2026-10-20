#!/usr/bin/env bash
# Upload a production Vite build of apps/content-backoffice over FTPS.
# Usage: bash scripts/ftp-deploy-backoffice.sh <env-file> [--dry-run]
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
env_file="${1:-}"
dry="${2:-}"
args=()
[[ -n "$env_file" ]] && args+=("$env_file")
[[ "$dry" == "--dry-run" ]] && args+=("--dry-run")
exec bash "$root/scripts/deploy/upload.sh" backoffice "${args[@]}"
