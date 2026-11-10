#!/usr/bin/env python3
"""Build a restrictive libpq service file from NEON_BACKUP_DATABASE_URL. Never prints secrets."""

from __future__ import annotations

import os
import re
import stat
import sys
import urllib.parse
from pathlib import Path

SERVICE_SECTION = "neon_backup"
POOLER_MARKERS = ("-pooler", ".pooler.", "-pooler.")


def _fail(msg: str, code: int = 2) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(code)


def _parse_query(query: str) -> dict[str, str]:
    pairs = urllib.parse.parse_qsl(query, keep_blank_values=True)
    return {k.lower(): v for k, v in pairs}


def _write_service(path: Path, fields: dict[str, str]) -> None:
    lines = [f"[{SERVICE_SECTION}]"]
    order = (
        "host",
        "port",
        "dbname",
        "user",
        "password",
        "sslmode",
        "channel_binding",
        "options",
    )
    for key in order:
        if key in fields and fields[key]:
            lines.append(f"{key}={fields[key]}")
    for key, value in sorted(fields.items()):
        if key in order or not value:
            continue
        lines.append(f"{key}={value}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    path.chmod(stat.S_IRUSR | stat.S_IWUSR)


def build_service_fields(uri: str) -> dict[str, str]:
    lowered = uri.lower()
    for marker in POOLER_MARKERS:
        if marker in lowered:
            _fail(
                "Pooler connection string rejected; use Neon direct (non-pooler) hostname."
            )

    parsed = urllib.parse.urlparse(uri)
    if parsed.scheme not in ("postgres", "postgresql"):
        _fail("Database URL must use postgresql:// or postgres:// scheme.")

    query = _parse_query(parsed.query or "")
    socket_dir = query.get("host", "")
    allow_local = os.environ.get("ALLOW_LOCAL_BACKUP_TEST") == "1"

    host = parsed.hostname
    if socket_dir.startswith("/"):
        if not allow_local:
            _fail("Unix-socket connections are only allowed in local backup tests.")
        host = socket_dir
    elif not host:
        _fail("Database URL is missing hostname.")
    elif host in ("localhost", "127.0.0.1", "::1") or host.endswith(".local"):
        if not allow_local:
            _fail("Localhost connections are not allowed for Neon backup.")

    port = parsed.port or 5432
    dbname = (parsed.path or "").lstrip("/") or "postgres"
    if not dbname:
        _fail("Database URL is missing database name.")

    user = urllib.parse.unquote(parsed.username or "")
    password = urllib.parse.unquote(parsed.password or "")
    if not user:
        _fail("Database URL is missing user.")
    if not password and not allow_local:
        _fail("Database URL is missing password.")

    if socket_dir.startswith("/"):
        port = ""
    sslmode = query.get("sslmode", "require")
    allowed_ssl = ("require", "verify-full", "verify-ca", "disable", "prefer")
    if sslmode not in allowed_ssl:
        _fail("Unsupported sslmode in database URL.")
    if not allow_local and sslmode not in ("require", "verify-full", "verify-ca"):
        _fail("sslmode must be require, verify-ca, or verify-full for Neon backup.")

    fields: dict[str, str] = {
        "host": host,
        "dbname": dbname,
        "user": user,
        "sslmode": sslmode,
    }
    if password:
        fields["password"] = password
    if port:
        fields["port"] = str(port)

    if "channel_binding" in query:
        fields["channel_binding"] = query["channel_binding"]
    if "options" in query:
        fields["options"] = query["options"]

    for key, value in query.items():
        if key in ("sslmode", "channel_binding", "options"):
            continue
        if re.fullmatch(r"[a-z0-9_-]+", key) and value:
            fields[key] = value

    return fields


def main() -> None:
    uri = (os.environ.get("NEON_BACKUP_DATABASE_URL") or "").strip()
    if not uri:
        _fail("NEON_BACKUP_DATABASE_URL is not set.")

    out_dir = Path(os.environ.get("BACKUP_PGCONF_DIR", "/tmp/neon-backup-pgconf"))
    out_dir.mkdir(parents=True, exist_ok=True)
    out_dir.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)

    service_path = out_dir / "pg_service.conf"
    fields = build_service_fields(uri)
    _write_service(service_path, fields)

    # Safe metadata for manifest (no host/user/password).
    print(f"PGSERVICEFILE={service_path}")
    print(f"PGSERVICE={SERVICE_SECTION}")
    print(f"SAFE_DB_NAME={fields['dbname']}")
    print(f"SAFE_DB_PORT={fields['port']}")
    print("SAFE_CONNECTION=direct-nonpooler")


if __name__ == "__main__":
    main()
