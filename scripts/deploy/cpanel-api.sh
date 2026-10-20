#!/usr/bin/env bash
# Probe cPanel UAPI for Passenger/WebApp restart and dependency install (no SSH).
# Sets outcome env vars for the workflow: CPANEL_RESTART_METHOD, CPANEL_NPM_METHOD.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=scripts/deploy/lib.sh
source "$root/scripts/deploy/lib.sh"

CPANEL_HOST="${CPANEL_HOST:-${FTP_HOST:-}}"
CPANEL_PORT="${CPANEL_PORT:-2083}"
CPANEL_USERNAME="${CPANEL_USERNAME:-${FTP_USER%%@*}}"
CPANEL_API_TOKEN="${CPANEL_API_TOKEN:-}"
CPANEL_APP_ROOT="${CPANEL_APP_ROOT:-${FTP_REMOTE_DIR:-node/kor-szupatak}}"
CPANEL_WEBAPP_NAME="${CPANEL_WEBAPP_NAME:-}"
CPANEL_PASSENGER_APP_NAME="${CPANEL_PASSENGER_APP_NAME:-}"

export CPANEL_RESTART_METHOD=none
export CPANEL_NPM_METHOD=none
export CPANEL_API_NOTES=""

if [[ -z "$CPANEL_API_TOKEN" || -z "$CPANEL_HOST" || -z "$CPANEL_USERNAME" ]]; then
  CPANEL_API_NOTES="cPanel API token vagy host hiányzik; csak FTP restart.txt fallback."
  echo "$CPANEL_API_NOTES"
  exit 0
fi

auth_header="Authorization: cpanel ${CPANEL_USERNAME}:${CPANEL_API_TOKEN}"
base="https://${CPANEL_HOST}:${CPANEL_PORT}/execute"

cpanel_uapi() {
  local module="$1"
  local func="$2"
  shift 2
  local qs=""
  local pair
  for pair in "$@"; do
    qs="${qs}&${pair}"
  done
  curl -fsS --max-time 45 -H "$auth_header" "${base}/${module}/${func}?api.version=1${qs}" 2>/dev/null || return 1
}

probe_token() {
  if cpanel_uapi Tokens list >/dev/null; then
    echo "cPanel API token OK (Tokens/list)."
    return 0
  fi
  echo "cPanel API token ellenőrzés sikertelen." >&2
  return 1
}

try_webapp_restart() {
  local name="$1"
  local resp
  resp="$(cpanel_uapi WebApp restart "name=${name}" 2>/dev/null)" || return 1
  if echo "$resp" | grep -q '"status":1'; then
    CPANEL_RESTART_METHOD="WebApp/restart:${name}"
    export CPANEL_RESTART_METHOD
    echo "WebApp restart sikeres: ${name}"
    return 0
  fi
  return 1
}

try_passenger_ensure_deps() {
  local app_name="$1"
  local resp
  resp="$(cpanel_uapi PassengerApps ensure_deps "name=${app_name}" 2>/dev/null)" || return 1
  if echo "$resp" | grep -q '"status":1'; then
    CPANEL_NPM_METHOD="PassengerApps/ensure_deps:${app_name}"
    export CPANEL_NPM_METHOD
    echo "PassengerApps ensure_deps elindítva: ${app_name}"
    return 0
  fi
  return 1
}

list_passenger_apps() {
  cpanel_uapi PassengerApps list_applications 2>/dev/null || true
}

list_webapps() {
  cpanel_uapi WebApp list 2>/dev/null || true
}

main() {
  probe_token || {
    CPANEL_API_NOTES="Token hibás; lásd docs/ci/github-actions-cpanel.md curl teszt."
    export CPANEL_API_NOTES
    exit 0
  }

  echo "--- WebApp/list (ha elérhető) ---"
  list_webapps | head -c 4000 || echo "(nincs WebApp modul vagy üres)"

  echo "--- PassengerApps/list_applications ---"
  local passenger_json
  passenger_json="$(list_passenger_apps)" || passenger_json=""
  echo "${passenger_json}" | head -c 4000

  if [[ -n "$CPANEL_WEBAPP_NAME" ]]; then
    try_webapp_restart "$CPANEL_WEBAPP_NAME" || true
  fi

  if [[ -z "$CPANEL_RESTART_METHOD" || "$CPANEL_RESTART_METHOD" == none ]]; then
    # Match by app root path in list output (heuristic).
    local slug=""
    if [[ -n "$passenger_json" ]]; then
      slug="$(echo "$passenger_json" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
    fi
    if [[ -n "$CPANEL_PASSENGER_APP_NAME" ]]; then
      slug="$CPANEL_PASSENGER_APP_NAME"
    fi
    if [[ -n "$slug" ]]; then
      try_passenger_ensure_deps "$slug" || true
    fi
  fi

  if [[ "${RUN_NPM_INSTALL:-}" == "1" ]]; then
    local dep_name="${CPANEL_PASSENGER_APP_NAME:-}"
    if [[ -z "$dep_name" && -n "$passenger_json" ]]; then
      dep_name="$(echo "$passenger_json" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
    fi
    if [[ -n "$dep_name" ]]; then
      try_passenger_ensure_deps "$dep_name" || CPANEL_API_NOTES="${CPANEL_API_NOTES} ensure_deps nem elérhető; manuális NPM Install."
    else
      CPANEL_API_NOTES="${CPANEL_API_NOTES} Passenger app név ismeretlen; manuális NPM Install."
    fi
  fi

  if [[ -z "$CPANEL_RESTART_METHOD" || "$CPANEL_RESTART_METHOD" == none ]]; then
    CPANEL_API_NOTES="${CPANEL_API_NOTES} UAPI restart nem található; FTP tmp/restart.txt fallback."
  fi
  export CPANEL_API_NOTES
  echo "Összegzés: RESTART=${CPANEL_RESTART_METHOD} NPM=${CPANEL_NPM_METHOD}"
  echo "${CPANEL_API_NOTES}"
}

main "$@"
