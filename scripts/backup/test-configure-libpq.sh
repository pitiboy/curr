#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

unset ALLOW_LOCAL_BACKUP_TEST

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

export BACKUP_PGCONF_DIR="$tmpdir/pgconf"

NEON_BACKUP_DATABASE_URL='postgresql://user:secret@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require' \
  python3 "$SCRIPT_DIR/configure-libpq.py" >/dev/null

[[ -f "$tmpdir/pgconf/pg_service.conf" ]] || {
  echo "pg_service.conf not created" >&2
  exit 1
}

grep -q 'sslmode=require' "$tmpdir/pgconf/pg_service.conf"
grep -q 'channel_binding=require' "$tmpdir/pgconf/pg_service.conf"

if NEON_BACKUP_DATABASE_URL='postgresql://user:secret@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require' \
  python3 "$SCRIPT_DIR/configure-libpq.py" >/dev/null 2>&1; then
  echo "pooler URL should be rejected" >&2
  exit 1
fi

if NEON_BACKUP_DATABASE_URL='postgresql://user:secret@localhost/neondb?sslmode=require' \
  python3 "$SCRIPT_DIR/configure-libpq.py" >/dev/null 2>&1; then
  echo "localhost URL should be rejected" >&2
  exit 1
fi

echo "configure-libpq tests OK"
