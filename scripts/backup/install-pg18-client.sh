#!/usr/bin/env bash
# Install PostgreSQL 18 client tools and age on ubuntu-latest runners.
set -euo pipefail

PG18_BIN="/usr/lib/postgresql/18/bin"

if [[ -x "${PG18_BIN}/pg_dump" ]] && "${PG18_BIN}/pg_dump" --version | grep -q ' (PostgreSQL) 18'; then
  :
else
  sudo install -d -m 0755 /usr/share/postgresql-common/pgdg
  sudo curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
  sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "${VERSION_CODENAME}")-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-client-18 age
fi

command -v age >/dev/null || sudo apt-get install -y age

[[ -x "${PG18_BIN}/pg_dump" ]] || {
  echo "postgresql-client-18 binaries missing under ${PG18_BIN}." >&2
  exit 1
}

"${PG18_BIN}/pg_dump" --version | grep -q ' (PostgreSQL) 18' || {
  echo "postgresql-client-18 installation failed." >&2
  exit 1
}

if [[ -n "${GITHUB_PATH:-}" ]]; then
  echo "$PG18_BIN" >>"$GITHUB_PATH"
fi

export PATH="${PG18_BIN}:${PATH}"
