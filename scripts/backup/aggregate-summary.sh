#!/usr/bin/env bash
# Summarize manifest JSON files and fail if any expected db slot is missing.
set -euo pipefail

if (($# == 0)); then
  echo "Usage: aggregate-summary.sh manifest-db-1.json ..." >&2
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

slots = {int(r["db_slot"]) for r in rows}
missing = [i for i in (1, 2, 3) if i not in slots]

total = sum(int(r.get("encrypted_bytes", 0)) for r in rows)
print("## Összesítés (3 adatbázis)")
print("")
print("| db slot | titkosított méret (bájt) | lista sorok |")
print("| --- | --- | --- |")
for r in sorted(rows, key=lambda x: int(x["db_slot"])):
    print(
        f"| db-{r['db_slot']} | {r.get('encrypted_bytes', 0)} | {r.get('archive_list_lines', 0)} |"
    )
print("")
print(f"**Összes titkosített méret (bájt):** {total}")
if missing:
    print("")
    print(f"**Hiányzó sikeres backup slot(ok):** {', '.join(f'db-{m}' for m in missing)}")
print("")
print(
    "Becsült artifact tárhely ≈ 30 nap × napi összesített méret "
    "(egy DB ~559 KB volt egyszeri mérés; a másik kettő nincs mérve)."
)
if missing:
    sys.exit(1)
PY
