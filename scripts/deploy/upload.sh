#!/usr/bin/env bash
# FTPS upload for Strapi backend and/or content-backoffice static build.
# Local:  bash scripts/deploy/upload.sh backend  .env.deploy:kor.fejlesztesek.hu [--dry-run]
# CI:     env FTP_* set → bash scripts/deploy/upload.sh backend [--dry-run]
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

# shellcheck source=scripts/deploy/lib.sh
source "$root/scripts/deploy/lib.sh"

target="${1:-}"
shift || true

env_file=""
dry=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry="--dry-run" ;;
    --env-file=*) env_file="${arg#--env-file=}" ;;
    *)
      if [[ -z "$env_file" && -f "$arg" ]]; then
        env_file="$arg"
      elif [[ "$arg" != --* ]]; then
        echo "Ismeretlen argumentum: $arg" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -n "$env_file" ]]; then
  load_deploy_env_file "$env_file" || {
    echo "Nincs ilyen env fájl: $env_file" >&2
    exit 1
  }
fi

require_ftp_vars
require_lftp
mirror_policies

export LFTP_PASSWORD="$FTP_PASS"

upload_backend() {
  if [[ ! -d dist ]]; then
    echo "Nincs dist könyvtár. Futtasd előbb: npm run build" >&2
    exit 1
  fi

  local index_put
  if [[ -n "$dry" ]]; then
    index_put="echo [dry-run] put dist/build/index.html"
  else
    index_put="put dist/build/index.html -o \"$FTP_REMOTE_DIR/dist/build/index.html\""
  fi

  echo "Backend feltöltés: host=${FTP_HOST} mappa=${FTP_REMOTE_DIR} policy=${FTP_OVERRIDE_POLICY}"
  set +e
  lftp --norc <<EOF
$(lftp_open_settings)
mirror -R -p -v $BUILD_POLICY --overwrite --delete --no-empty-dirs $dry -x '^index\.html\$' dist/build "$FTP_REMOTE_DIR/dist/build"
mirror -R -p -v $MIRROR_POLICY --overwrite --delete --no-empty-dirs $dry -x '^build/' dist "$FTP_REMOTE_DIR/dist"
mirror -R -p -v $MIRROR_POLICY --overwrite --no-empty-dirs $dry \
  -i '^(public(\$|/)|package\.json\$|package-lock\.json\$|server\.js\$|favicon\.(png|ico)\$|database/seeders/http/[^/]+/data/backoffice-features\.json\$)' \
  -x '(^|/)public/uploads(/|\$)' \
  -x '(^|/)\\.' \
  . "$FTP_REMOTE_DIR"
$index_put
bye
EOF
  local status=$?
  set -e
  return "$status"
}

upload_backoffice() {
  local local_dist="$root/apps/content-backoffice/dist"
  if [[ ! -d "$local_dist" ]]; then
    echo "Nincs apps/content-backoffice/dist. Build előbb." >&2
    exit 1
  fi
  local remote_target="${FTP_REMOTE_DIR}/${FTP_BACKOFFICE_REMOTE_DIR}"
  echo "Backoffice feltöltés: host=${FTP_HOST} mappa=${remote_target} policy=${FTP_OVERRIDE_POLICY}"
  set +e
  lftp --norc <<EOF
$(lftp_open_settings)
mirror -R -p -v $MIRROR_POLICY --overwrite --delete --no-empty-dirs $dry "$local_dist" "$remote_target"
bye
EOF
  local status=$?
  set -e
  return "$status"
}

upload_passenger_restart_file() {
  local app_root="${CPANEL_APP_ROOT:-$FTP_REMOTE_DIR}"
  app_root="${app_root#/}"
  echo "Passenger restart jel: tmp/restart.txt → ${app_root}/tmp/restart.txt"
  if [[ -n "$dry" ]]; then
    echo "[dry-run] restart.txt"
    return 0
  fi
  local tmp
  tmp="$(mktemp)"
  date -u +"%Y-%m-%dT%H:%M:%SZ deploy" >"$tmp"
  set +e
  lftp --norc <<EOF
$(lftp_open_settings)
mkdir -p -f "$app_root/tmp"
put "$tmp" -o "$app_root/tmp/restart.txt"
bye
EOF
  local status=$?
  set -e
  rm -f "$tmp"
  return "$status"
}

backup_backend_build() {
  if [[ "${DEPLOY_SKIP_BACKUP:-}" == "1" ]]; then
    return 0
  fi
  local stamp tmpdir
  stamp="$(date -u +"%Y%m%dT%H%M%SZ")"
  local backup_dir="${FTP_REMOTE_DIR}/_deploy_backups/${stamp}/dist/build"
  echo "Biztonsági másolat (dist/build): ${backup_dir}"
  if [[ -n "$dry" ]]; then
    echo "[dry-run] backup mirror"
    return 0
  fi
  tmpdir="$(mktemp -d)"
  set +e
  lftp --norc <<EOF
$(lftp_open_settings)
mirror -p -v --only-newer "$FTP_REMOTE_DIR/dist/build" "$tmpdir/dist/build"
mkdir -p -f "$backup_dir"
mirror -R -p -v --only-newer "$tmpdir/dist/build" "$backup_dir"
bye
EOF
  local status=$?
  set -e
  rm -rf "$tmpdir"
  if [[ "$status" -ne 0 ]]; then
    echo "Figyelmeztetés: backup nem sikerült (status=${status}); a deploy folytatódik." >&2
  fi
}

case "$target" in
  backend)
    backup_backend_build || true
    upload_backend
    ;;
  backoffice)
    upload_backoffice
    ;;
  both)
    backup_backend_build || true
    upload_backend
    upload_backoffice
    ;;
  restart-txt)
    upload_passenger_restart_file
    ;;
  *)
    echo "Használat: bash scripts/deploy/upload.sh {backend|backoffice|both|restart-txt} [env-file] [--dry-run]" >&2
    exit 1
    ;;
esac

status=$?
if [[ "$status" -eq 0 ]]; then
  printf '\n\033[1;32mFeltöltés kész (%s).\033[0m\n' "$target"
else
  printf '\n\033[1;31mFeltöltés hibával állt meg (lftp: %s).\033[0m\n' "$status"
  exit "$status"
fi
