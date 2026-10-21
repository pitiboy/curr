#!/usr/bin/env bash
# npm run deploy / deploy:backoffice wrapper: build, FTPS upload, rolling log, git commit+push.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

target="${1:-}"
if [[ -z "$target" ]]; then
  echo "Használat: bash scripts/deploy-with-log.sh <strapi|backoffice>" >&2
  exit 1
fi

env_file=".env.deploy:kor.fejlesztesek.hu"
log_script="$root/scripts/deploy-log.sh"

record_and_commit() {
  local command="$1"
  local build_status="$2"
  local ftp_status="$3"
  bash "$log_script" append "$command" "$build_status" "$ftp_status"
  bash "$log_script" commit
  echo
  tail -n 6 build-deploy.log
}

case "$target" in
  strapi)
    attempted="npm run deploy"
    build_cmd=(npm run build)
    ftp_cmd=(bash scripts/ftp-deploy.sh "$env_file")
    ;;
  backoffice)
    attempted="npm run deploy:backoffice"
    build_cmd=(npm run build:f:kor.fejlesztesek.hu)
    ftp_cmd=(bash scripts/ftp-deploy-backoffice.sh "$env_file")
    ;;
  *)
    echo "Ismeretlen cél: $target (strapi vagy backoffice)" >&2
    exit 1
    ;;
esac

build_status="failed"
ftp_status="skipped"

if "${build_cmd[@]}"; then
  build_status="success"
else
  record_and_commit "$attempted" "$build_status" "$ftp_status"
  exit 1
fi

set +e
"${ftp_cmd[@]}"
ftp_exit=$?
set -e

if [[ "$ftp_exit" -eq 0 ]]; then
  ftp_status="success"
else
  ftp_status="failed (exit ${ftp_exit})"
fi

record_and_commit "$attempted" "$build_status" "$ftp_status"

if [[ "$target" == "strapi" && "$ftp_exit" -eq 0 ]]; then
  DEPLOY_DEPS_BASELINE=previous bash "$root/scripts/deploy-strapi-deps.sh" warn-if-changed
fi

if [[ "$ftp_exit" -ne 0 ]]; then
  exit "$ftp_exit"
fi
