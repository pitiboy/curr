#!/usr/bin/env bash
# HTTP health checks with exponential backoff.
set -euo pipefail

BASE_URL="${DEPLOY_BASE_URL:-https://kor.fejlesztesek.hu}"
BASE_URL="${BASE_URL%/}"

check_backend="${CHECK_BACKEND:-1}"
check_backoffice="${CHECK_BACKOFFICE:-1}"
max_attempts="${HEALTH_MAX_ATTEMPTS:-8}"
initial_wait="${HEALTH_INITIAL_WAIT_SEC:-5}"

paths=()
if [[ "$check_backend" == "1" ]]; then
  # Strapi /_health responds 204 No Content when the process is up.
  paths+=("/_health" "/admin")
fi
if [[ "$check_backoffice" == "1" ]]; then
  paths+=("/backoffice/")
fi

fail=0
for path in "${paths[@]}"; do
  url="${BASE_URL}${path}"
  attempt=1
  wait="$initial_wait"
  ok=0
  while [[ "$attempt" -le "$max_attempts" ]]; do
    # No curl -f: it conflates transport failure with HTTP status, and with
    # || echo 000 can produce codes like 204000 on timeout-after-headers.
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 -L "$url" || true)"
    code="${code#"${code%%[![:space:]]*}"}"
    code="${code%"${code##*[![:space:]]}"}"
    # Accept any 2xx/3xx (Strapi /_health → 204).
    if [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
      echo "OK ${url} → HTTP ${code} (attempt ${attempt})"
      ok=1
      break
    fi
    echo "Várakozás ${url} (HTTP ${code:-000}, attempt ${attempt}/${max_attempts}, ${wait}s)"
    sleep "$wait"
    wait=$((wait * 2))
    if [[ "$wait" -gt 120 ]]; then
      wait=120
    fi
    attempt=$((attempt + 1))
  done
  if [[ "$ok" -ne 1 ]]; then
    echo "HIBA: ${url} nem válaszolt elfogadható státusszal." >&2
    fail=1
  fi
done

exit "$fail"
