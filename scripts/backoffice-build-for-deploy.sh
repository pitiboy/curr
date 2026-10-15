#!/usr/bin/env bash
# Production Vite build for content-backoffice using VITE_* vars from a deploy env file.
# Usage: bash scripts/backoffice-build-for-deploy.sh <env-file>
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

env_file="${1:-}"
if [[ -z "$env_file" ]]; then
  echo "Használat: bash scripts/backoffice-build-for-deploy.sh <env-fájl>" >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "Nincs ilyen env fájl: $env_file" >&2
  exit 1
fi

load_deploy_env() {
  local file="$1"
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    [[ "$key" == VITE_* ]] || continue
    value="${BASH_REMATCH[2]}"
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    printf -v "$key" '%s' "$value"
    export "$key"
  done < "$file"
}

load_deploy_env "$env_file"

if [[ -z "${VITE_STRAPI_URL:-}" ]]; then
  echo "Hiányzik a VITE_STRAPI_URL a(z) $env_file fájlból." >&2
  exit 1
fi

echo "Backoffice build: VITE_STRAPI_URL=${VITE_STRAPI_URL}"
exec npx nx run content-backoffice:build
