#!/usr/bin/env bash
# Upload a locally built Strapi tree over FTPS.
# Usage: bash scripts/ftp-deploy.sh <env-file> [--dry-run]
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

env_file="${1:-}"
if [[ -z "$env_file" || "$env_file" == --* ]]; then
  echo "Használat: bash scripts/ftp-deploy.sh <env-fájl> [--dry-run]" >&2
  exit 1
fi
shift

dry=""
if [[ "${1:-}" == "--dry-run" ]]; then
  dry="--dry-run"
fi

if [[ ! -f "$env_file" ]]; then
  echo "Nincs ilyen env fájl: $env_file" >&2
  echo "A minta: .env.deploy.example" >&2
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
    [[ "$key" == FTP_* ]] || continue
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

FTP_PORT="${FTP_PORT:-21}"
FTP_OVERRIDE_POLICY="${FTP_OVERRIDE_POLICY:-only-newer}"
case "$FTP_OVERRIDE_POLICY" in
  only-newer) mirror_policy="--only-newer" ;;
  transfer-all) mirror_policy="--transfer-all" ;;
  *)
    echo "Ismeretlen FTP_OVERRIDE_POLICY: ${FTP_OVERRIDE_POLICY} (only-newer vagy transfer-all)" >&2
    exit 1
    ;;
esac

missing=()
[[ -n "${FTP_HOST:-}" ]] || missing+=("FTP_HOST")
[[ -n "${FTP_USER:-}" ]] || missing+=("FTP_USER")
[[ -n "${FTP_PASS:-}" ]] || missing+=("FTP_PASS")
[[ -n "${FTP_REMOTE_DIR:-}" ]] || missing+=("FTP_REMOTE_DIR")
if ((${#missing[@]})); then
  echo "Hiányzik a(z) $env_file fájlból: ${missing[*]}" >&2
  exit 1
fi

command -v lftp >/dev/null || {
  echo "Az lftp nincs telepítve. macOS: brew install lftp" >&2
  exit 1
}

FTP_HOST="${FTP_HOST#ftp://}"
FTP_HOST="${FTP_HOST#ftps://}"
FTP_HOST="${FTP_HOST%/}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR#/}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR%/}"

if [[ ! -d dist ]]; then
  echo "Nincs dist könyvtár. A npm run deploy a feltöltés előtt lebuildeli." >&2
  exit 1
fi

export LFTP_PASSWORD="$FTP_PASS"

echo "Feltöltés: user=${FTP_USER} host=${FTP_HOST} port=${FTP_PORT} mappa=${FTP_REMOTE_DIR} policy=${FTP_OVERRIDE_POLICY}"
set +e
lftp --norc <<EOF
set cmd:fail-exit yes
set ftp:ssl-allow true
set ftp:ssl-force true
set ftp:passive-mode true
set ssl:verify-certificate no
set net:timeout 30
set net:max-retries 2
open --env-password -u "$FTP_USER" -p "$FTP_PORT" "$FTP_HOST"
mirror -R -p -v $mirror_policy --overwrite --no-empty-dirs $dry -i '^(dist(\$|/)|public(\$|/)|package\.json\$|package-lock\.json\$|server\.js\$|favicon\.(png|ico)\$)' -x '(^|/)public/uploads(/|\$)' -x '(^|/)\\.' . "$FTP_REMOTE_DIR"
bye
EOF
status=$?
set -e

if [[ "$status" -eq 0 ]]; then
  printf '\n\033[1;32m%s\033[0m\n\033[1;33m%s\033[0m\n' \
    "A fájlok fent vannak. A szerver .env-je és a node_modules symlink megmaradt." \
    "Utána a célalkalmazáson NPM Install, majd újraindítás. Közös fánál az aliasokat is indítsd újra." >&2
else
  printf '\n\033[1;31m%s\033[0m\n' \
    "A feltöltés hibával állt meg (lftp kilépés: ${status}). A fájlok nincsenek fent." >&2
  exit "$status"
fi
