#!/usr/bin/env bash
# Shared deploy helpers: env from file and/or process environment (CI secrets).
set -euo pipefail

deploy_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

# Load FTP_* and optional CPANEL_* / VITE_* from a deploy env file (local).
load_deploy_env_file() {
  local file="$1"
  local line key value
  [[ -f "$file" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    # Do not overwrite variables already set (CI secrets win).
    if [[ -z "${!key:-}" ]]; then
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done < "$file"
}

normalize_ftp_host() {
  FTP_HOST="${FTP_HOST#ftp://}"
  FTP_HOST="${FTP_HOST#ftps://}"
  FTP_HOST="${FTP_HOST%/}"
  export FTP_HOST
}

normalize_remote_dir() {
  local var_name="$1"
  local val="${!var_name}"
  val="${val#/}"
  val="${val%/}"
  printf -v "$var_name" '%s' "$val"
  export "$var_name"
}

require_ftp_vars() {
  local missing=()
  [[ -n "${FTP_HOST:-}" ]] || missing+=("FTP_HOST")
  [[ -n "${FTP_USER:-}" ]] || missing+=("FTP_USER")
  [[ -n "${FTP_PASS:-}" ]] || missing+=("FTP_PASS")
  [[ -n "${FTP_REMOTE_DIR:-}" ]] || missing+=("FTP_REMOTE_DIR")
  if ((${#missing[@]})); then
    echo "Hiányzó FTP beállítás: ${missing[*]}" >&2
    echo "Add meg a .env.deploy fájlban vagy GitHub Secrets-ben." >&2
    return 1
  fi
  FTP_PORT="${FTP_PORT:-21}"
  FTP_OVERRIDE_POLICY="${FTP_OVERRIDE_POLICY:-only-newer}"
  FTP_BACKOFFICE_REMOTE_DIR="${FTP_BACKOFFICE_REMOTE_DIR:-public/backoffice}"
  export FTP_PORT FTP_OVERRIDE_POLICY FTP_BACKOFFICE_REMOTE_DIR
  normalize_ftp_host
  normalize_remote_dir FTP_REMOTE_DIR
  normalize_remote_dir FTP_BACKOFFICE_REMOTE_DIR
}

require_lftp() {
  command -v lftp >/dev/null || {
    echo "Az lftp nincs telepítve." >&2
    exit 1
  }
}

mirror_policies() {
  case "$FTP_OVERRIDE_POLICY" in
    only-newer)
      MIRROR_POLICY="--only-newer"
      BUILD_POLICY="--only-missing"
      ;;
    transfer-all)
      MIRROR_POLICY="--transfer-all"
      BUILD_POLICY="--transfer-all"
      ;;
    *)
      echo "Ismeretlen FTP_OVERRIDE_POLICY: ${FTP_OVERRIDE_POLICY}" >&2
      exit 1
      ;;
  esac
  export MIRROR_POLICY BUILD_POLICY
}

lftp_open_settings() {
  cat <<EOF
set cmd:fail-exit yes
set ftp:ssl-allow true
set ftp:ssl-force true
set ftp:passive-mode true
set ssl:verify-certificate no
set net:timeout 30
set net:max-retries 2
open --env-password -u "$FTP_USER" -p "$FTP_PORT" "$FTP_HOST"
EOF
}
