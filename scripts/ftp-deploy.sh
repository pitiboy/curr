#!/usr/bin/env bash
# Upload a locally built Strapi tree over FTPS.
# Usage: bash scripts/ftp-deploy.sh <env-file> [--dry-run]
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
# shellcheck source=ftp-deploy-log-hook.sh
source "$root/scripts/ftp-deploy-log-hook.sh"

env_file="${1:-}"
dry="${2:-}"
args=()
[[ -n "$env_file" ]] && args+=("$env_file")
[[ "$dry" == "--dry-run" ]] && args+=("--dry-run")
exec bash "$root/scripts/deploy/upload.sh" backend "${args[@]}"
