#!/usr/bin/env bash
# Summarize manifest JSON files and fail if any expected db key is missing.
set -euo pipefail

if (($# == 0)); then
  echo "Usage: aggregate-summary.sh manifest-db-zep.json ..." >&2
  exit 1
fi

python3 - "$@" <<'PY'
import json
import sys
from pathlib import Path

paths = [Path(p) for p in sys.argv[1:]]
rows = []
for path in sorted(paths):
    data = json.loads(path.read_text(encoding="utf-8"))
    rows.append(data)

expected = ("zep", "edizone")
found = {str(r.get("db_key", "")).lower() for r in rows}
missing = [k for k in expected if k not in found]

total = sum(int(r.get("encrypted_bytes", 0)) for r in rows)
print("## Összesítés (2 adatbázis)")
print("")
print("| db | titkosított méret (bájt) | lista sorok |")
print("| --- | --- | --- |")
for key in expected:
    match = next((r for r in rows if str(r.get("db_key", "")).lower() == key), None)
    if match:
        print(
            f"| db-{key} | {match.get('encrypted_bytes', 0)} | {match.get('archive_list_lines', 0)} |"
        )
print("")
print(f"**Összes titkosított méret (bájt):** {total}")
if missing:
    print("")
    print(f"**Hiányzó sikeres backup:** {', '.join(f'db-{m}' for m in missing)}")
print("")
print(
    "Becsült artifact tárhely ≈ 30 nap × napi összesített méret "
    "(egy DB ~559 KB volt egyszeri mérés; a másik nincs mérve)."
)
if missing:
    sys.exit(1)
PY
