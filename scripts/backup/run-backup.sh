#!/usr/bin/env bash
# Logical backup for one DB slot: pg_dump -Fc, age encrypt, manifest, artifact staging.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/backup/cleanup-trap.sh
source "$SCRIPT_DIR/cleanup-trap.sh"

sanitize_err() {
  "$SCRIPT_DIR/sanitize-log.sh"
}

on_err() {
  local code=$?
  local line=${BASH_LINENO[0]:-unknown}
  echo "Backup failed (db_slot=${DB_SLOT:-?}, exit=$code, line=$line)." >&2 | sanitize_err
  backup_cleanup
  exit "$code"
}
trap on_err ERR
trap backup_cleanup EXIT

: "${DB_SLOT:?DB_SLOT is required (1, 2, or 3)}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"

var_name="NEON_BACKUP_DATABASE_URL_${DB_SLOT}"
NEON_BACKUP_DATABASE_URL="${!var_name:-}"
if [[ -z "$NEON_BACKUP_DATABASE_URL" ]]; then
  echo "Secret ${var_name} is not set." >&2 | sanitize_err
  exit 2
fi
export NEON_BACKUP_DATABASE_URL

RUN_ID="${GITHUB_RUN_ID:-local}"
STAMP_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_ROOT="${RUNNER_TEMP:-/tmp}/neon-backup/db-${DB_SLOT}-${RUN_ID}-${STAMP_UTC}"
STAGING="${WORK_ROOT}/artifact"
ARTIFACT_OUT="${BACKUP_ARTIFACT_ROOT:-${RUNNER_TEMP:-/tmp}/neon-backup-publish}/db-${DB_SLOT}-${RUN_ID}-${STAMP_UTC}"
PLAIN_DUMP="${WORK_ROOT}/dump.dump"
ENCRYPTED="${WORK_ROOT}/dump.dump.age"
MANIFEST="${STAGING}/manifest-db-${DB_SLOT}.json"
CHECKSUMS="${STAGING}/checksums-db-${DB_SLOT}.txt"
ENCRYPTED_NAME="neon-pg-backup-db-${DB_SLOT}-${STAMP_UTC}.dump.age"

backup_register_cleanup "$WORK_ROOT"
mkdir -p "$STAGING"
chmod 700 "$WORK_ROOT"

command -v pg_dump >/dev/null || {
  echo "pg_dump not found." >&2
  exit 1
}
command -v pg_restore >/dev/null || {
  echo "pg_restore not found." >&2
  exit 1
}
command -v age >/dev/null || {
  echo "age not found." >&2
  exit 1
}
command -v python3 >/dev/null || {
  echo "python3 not found." >&2
  exit 1
}

PG_DUMP_VER="$(pg_dump --version | head -n1)"
if [[ "${ALLOW_LEGACY_PG_CLIENT:-}" != "1" ]]; then
  if [[ "$PG_DUMP_VER" != *" (PostgreSQL) 18."* && "$PG_DUMP_VER" != *" (PostgreSQL) 18"* ]]; then
    echo "PostgreSQL client 18 required; got: $PG_DUMP_VER" >&2
    exit 1
  fi
fi

mapfile -t libpq_meta < <(
  BACKUP_PGCONF_DIR="${WORK_ROOT}/pgconf" python3 "$SCRIPT_DIR/configure-libpq.py" 2> >(
    sanitize_err
    cat >&2
  )
)

for line in "${libpq_meta[@]}"; do
  export "$line"
done

export PGTZ=UTC

server_version="$(
  psql -v ON_ERROR_STOP=1 -c 'SHOW server_version;' 2> >(
    sanitize_err
    cat >&2
  ) | tail -n1 | xargs
)"
server_version_num="$(
  psql -v ON_ERROR_STOP=1 -tAc 'SHOW server_version_num;' 2> >(
    sanitize_err
    cat >&2
  ) | tr -d '[:space:]'
)"
client_version_num="$(pg_dump --version | sed -n 's/.* (PostgreSQL) \([0-9]*\).*/\1/p')"

if [[ -z "$server_version_num" || -z "$client_version_num" ]]; then
  echo "Could not determine PostgreSQL server/client versions." >&2
  exit 1
fi

server_major="${server_version_num:0:2}"
client_major="${client_version_num:0:2}"
if ((client_major < server_major)); then
  echo "pg_dump client major ($client_major) is older than server ($server_major)." >&2
  exit 1
fi

pg_dump -Fc -f "$PLAIN_DUMP" 2> >(
  sanitize_err
  cat >&2
)

if [[ ! -s "$PLAIN_DUMP" ]]; then
  echo "pg_dump produced an empty file." >&2
  exit 1
fi

list_count="$(
  pg_restore --list "$PLAIN_DUMP" 2> >(
    sanitize_err
    cat >&2
  ) | wc -l | tr -d '[:space:]'
)"

plain_bytes="$(wc -c <"$PLAIN_DUMP" | tr -d '[:space:]')"
plain_sha="$(sha256sum "$PLAIN_DUMP" | awk '{print $1}')"

age -r "$BACKUP_AGE_RECIPIENT" -o "$ENCRYPTED" "$PLAIN_DUMP"
rm -f "$PLAIN_DUMP"

encrypted_bytes="$(wc -c <"$ENCRYPTED" | tr -d '[:space:]')"
encrypted_sha="$(sha256sum "$ENCRYPTED" | awk '{print $1}')"

mkdir -p "$ARTIFACT_OUT"
chmod 700 "$ARTIFACT_OUT"
cp "$ENCRYPTED" "${STAGING}/${ENCRYPTED_NAME}"
cp -a "$STAGING/." "$ARTIFACT_OUT/"

export SERVER_VERSION="$server_version"
export SERVER_VERSION_NUM="$server_version_num"
export LIST_COUNT="$list_count"
export PLAIN_BYTES="$plain_bytes"
export ENCRYPTED_BYTES="$encrypted_bytes"
export PLAIN_SHA="$plain_sha"
export ENCRYPTED_SHA="$encrypted_sha"
export STAMP_UTC="$STAMP_UTC"
export PG_DUMP_VER

python3 - "$MANIFEST" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

path = sys.argv[1]
data = {
    "workflow": "Neon Postgres backup",
    "db_slot": os.environ["DB_SLOT"],
    "created_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "run_id": os.environ.get("GITHUB_RUN_ID", "local"),
    "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT", "1"),
    "pg_dump_format": "custom",
    "pg_dump_version": os.environ.get("PG_DUMP_VER", ""),
    "server_version": os.environ.get("SERVER_VERSION", ""),
    "server_version_num": os.environ.get("SERVER_VERSION_NUM", ""),
    "database_name": os.environ.get("SAFE_DB_NAME", ""),
    "database_port": os.environ.get("SAFE_DB_PORT", ""),
    "connection_kind": os.environ.get("SAFE_CONNECTION", "direct-nonpooler"),
    "archive_list_lines": int(os.environ.get("LIST_COUNT", "0")),
    "plaintext_dump_bytes": int(os.environ.get("PLAIN_BYTES", "0")),
    "encrypted_bytes": int(os.environ.get("ENCRYPTED_BYTES", "0")),
    "plaintext_sha256": os.environ.get("PLAIN_SHA", ""),
    "encrypted_sha256": os.environ.get("ENCRYPTED_SHA", ""),
    "encrypted_file": f"neon-pg-backup-db-{os.environ['DB_SLOT']}-{os.environ.get('STAMP_UTC', '')}.dump.age",
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

{
  echo "# neon-pg-backup db-${DB_SLOT}"
  echo "${encrypted_sha}  ${ENCRYPTED_NAME}"
} >"$CHECKSUMS"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "encrypted_bytes=${encrypted_bytes}" >>"$GITHUB_OUTPUT"
  echo "artifact_dir=${ARTIFACT_OUT}" >>"$GITHUB_OUTPUT"
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### db-${DB_SLOT} backup"
    echo ""
    echo "| Mező | Érték |"
    echo "| --- | --- |"
    echo "| Időbélyeg (UTC) | ${STAMP_UTC} |"
    echo "| Titkosított méret (bájt) | ${encrypted_bytes} |"
    echo "| pg_restore --list sorok | ${list_count} |"
    echo "| DB név (manifest) | ${SAFE_DB_NAME} |"
  } >>"$GITHUB_STEP_SUMMARY"
fi

echo "Backup db-${DB_SLOT} OK (encrypted_bytes=${encrypted_bytes})."
echo "ARTIFACT_STAGING=${ARTIFACT_OUT}"
