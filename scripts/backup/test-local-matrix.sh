#!/usr/bin/env bash
# End-to-end backup test: three disposable DBs, parallel success, isolated failure on db-2.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export ALLOW_LEGACY_PG_CLIENT=1

for pg_bindir in /usr/lib/postgresql/*/bin; do
  [[ -x "${pg_bindir}/initdb" ]] || continue
  export PATH="${pg_bindir}:$PATH"
  break
done

WORKDIR="$(mktemp -d)"
AGE_DIR="${WORKDIR}/age"
DATA_DIR="${WORKDIR}/pgdata"
LOG_DIR="${WORKDIR}/logs"
mkdir -p "$AGE_DIR" "$DATA_DIR" "$LOG_DIR"

cleanup() {
  if [[ -n "${PG_PID:-}" ]] && kill -0 "$PG_PID" 2>/dev/null; then
    kill "$PG_PID" 2>/dev/null || true
    wait "$PG_PID" 2>/dev/null || true
  fi
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

command -v age-keygen >/dev/null || {
  echo "age-keygen not found; install age package." >&2
  exit 1
}
command -v initdb >/dev/null || {
  echo "initdb not found; install postgresql server for local test." >&2
  exit 1
}

age-keygen -o "${AGE_DIR}/key.txt" >/dev/null 2>&1
PUB="$(grep '^# public key:' "${AGE_DIR}/key.txt" | awk '{print $NF}')"
export BACKUP_AGE_RECIPIENT="$PUB"

export PGDATA="$DATA_DIR"
TEST_PORT=$((55432 + RANDOM % 1000))
initdb -A trust -U postgres >/dev/null
{
  echo "port = ${TEST_PORT}"
  echo "listen_addresses = '127.0.0.1'"
  echo "unix_socket_directories = '${WORKDIR}'"
} >>"$PGDATA/postgresql.conf"
postgres -D "$PGDATA" >"${LOG_DIR}/postgres.log" 2>&1 &
PG_PID=$!
for _ in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -p "$TEST_PORT" -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
pg_isready -h 127.0.0.1 -p "$TEST_PORT" -U postgres >/dev/null || {
  echo "Postgres did not become ready on port ${TEST_PORT}." >&2
  cat "${LOG_DIR}/postgres.log" >&2
  exit 1
}

createdb -h 127.0.0.1 -p "$TEST_PORT" -U postgres backup_db1
createdb -h 127.0.0.1 -p "$TEST_PORT" -U postgres backup_db2
createdb -h 127.0.0.1 -p "$TEST_PORT" -U postgres backup_db3

psql -h 127.0.0.1 -p "$TEST_PORT" -U postgres -d backup_db1 -v ON_ERROR_STOP=1 -c \
  'CREATE TABLE t1 (id int primary key); INSERT INTO t1 VALUES (1),(2);'
psql -h 127.0.0.1 -p "$TEST_PORT" -U postgres -d backup_db2 -v ON_ERROR_STOP=1 -c \
  'CREATE TABLE t2 (id int primary key); INSERT INTO t2 VALUES (10);'
psql -h 127.0.0.1 -p "$TEST_PORT" -U postgres -d backup_db3 -v ON_ERROR_STOP=1 -c \
  'CREATE TABLE t3 (id int primary key); INSERT INTO t3 VALUES (100),(101),(102);'

uri_for() {
  local db="$1"
  printf 'postgresql://postgres:localtest@127.0.0.1:%s/%s?sslmode=disable' "$TEST_PORT" "$db"
}

export NEON_BACKUP_DATABASE_URL_1
export NEON_BACKUP_DATABASE_URL_2
export NEON_BACKUP_DATABASE_URL_3
NEON_BACKUP_DATABASE_URL_1="$(uri_for backup_db1)"
NEON_BACKUP_DATABASE_URL_2="$(uri_for backup_db2)"
NEON_BACKUP_DATABASE_URL_3="$(uri_for backup_db3)"

unset ALLOW_LOCAL_BACKUP_TEST
bash "$SCRIPT_DIR/test-configure-libpq.sh"
export ALLOW_LOCAL_BACKUP_TEST=1
bash "$SCRIPT_DIR/preflight.sh"

run_slot() {
  local slot="$1"
  local out staging
  set +e
  out="$(
    ALLOW_LEGACY_PG_CLIENT=1 ALLOW_LOCAL_BACKUP_TEST=1 DB_SLOT="$slot" \
      BACKUP_ARTIFACT_ROOT="${LOG_DIR}/artifacts" \
      bash "$SCRIPT_DIR/run-backup.sh" 2>"${LOG_DIR}/err-${slot}.log"
  )"
  local code=$?
  set -e
  [[ "$code" -eq 0 ]] || {
    echo "run_slot ${slot} failed:" >&2
    cat "${LOG_DIR}/err-${slot}.log" >&2
    return "$code"
  }
  echo "$out" >"${LOG_DIR}/ok-${slot}.log"
  staging="$(echo "$out" | sed -n 's/^ARTIFACT_STAGING=//p')"
  echo "$staging" >"${LOG_DIR}/staging-${slot}.txt"
}

run_slot 1 &
pid1=$!
run_slot 3 &
pid3=$!
wait "$pid1"
wait "$pid3"

# Independent failure: invalid pooler-like host must not stop other completed jobs.
export NEON_BACKUP_DATABASE_URL_2='postgresql://postgres:secret@ep-test-pooler.neon.tech/backup_db2?sslmode=require'
set +e
ALLOW_LEGACY_PG_CLIENT=1 ALLOW_LOCAL_BACKUP_TEST=1 DB_SLOT=2 \
  bash "$SCRIPT_DIR/run-backup.sh" >"${LOG_DIR}/fail-2.log" 2>&1
fail_code=$?
set -e
if [[ "$fail_code" -eq 0 ]]; then
  echo "Expected db-2 failure with pooler URL" >&2
  exit 1
fi

# Restore slot 2 and run successful backup for decrypt round-trip.
export NEON_BACKUP_DATABASE_URL_2="$(uri_for backup_db2)"
run_slot 2

for slot in 1 2 3; do
  staging="$(cat "${LOG_DIR}/staging-${slot}.txt")"
  dump="$(find "$staging" -name "neon-pg-backup-db-${slot}-*.dump.age" -type f | head -n1)"
  [[ -n "$dump" ]] || {
    echo "Missing encrypted dump for db-${slot}" >&2
    exit 1
  }
  plain="${WORKDIR}/roundtrip-${slot}.dump"
  age -d -i "${AGE_DIR}/key.txt" -o "$plain" "$dump"
  pg_restore --list "$plain" >/dev/null
  restore_db="restore_db${slot}"
  createdb -h 127.0.0.1 -p "$TEST_PORT" -U postgres "$restore_db"
  pg_restore -h 127.0.0.1 -p "$TEST_PORT" -U postgres -d "$restore_db" --no-owner --no-acl "$plain"
done

count1="$(psql -h 127.0.0.1 -p "$TEST_PORT" -U postgres -d restore_db1 -tAc 'SELECT count(*) FROM t1;' | tr -d '[:space:]')"
count3="$(psql -h 127.0.0.1 -p "$TEST_PORT" -U postgres -d restore_db3 -tAc 'SELECT count(*) FROM t3;' | tr -d '[:space:]')"
[[ "$count1" == "2" && "$count3" == "3" ]] || {
  echo "Restore row counts mismatch" >&2
  exit 1
}

echo "Local matrix test OK (3 DB backup, isolated db-2 failure, decrypt + pg_restore)."
