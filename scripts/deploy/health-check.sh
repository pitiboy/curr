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
    code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 30 -L "$url" 2>/dev/null || echo "000")"
    # Strapi /_health responds 204 No Content when the process is up.
    if [[ "$code" =~ ^(200|204|301|302|303|307|308)$ ]]; then
      echo "OK ${url} → HTTP ${code} (attempt ${attempt})"
      ok=1
      break
    fi
    echo "Várakozás ${url} (HTTP ${code}, attempt ${attempt}/${max_attempts}, ${wait}s)"
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
