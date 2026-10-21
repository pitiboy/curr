#!/usr/bin/env bash
# Rolling build & deploy audit log at repo root (+ optional git commit/push).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="${DEPLOY_LOG_FILE:-build-deploy.log}"
LOG_PATH="$root/$LOG_FILE"
MAX_ENTRIES="${DEPLOY_LOG_MAX_ENTRIES:-80}"
MARKER="--- deploy event ---"

append_deploy_log() {
  local command="$1"
  local build_status="$2"
  local ftp_status="${3:-n/a}"
  local timestamp
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  python3 - "$LOG_PATH" "$MAX_ENTRIES" "$MARKER" "$timestamp" "$command" "$build_status" "$ftp_status" <<'PY'
import sys
from pathlib import Path

path, max_entries, marker, ts, command, build_status, ftp_status = sys.argv[1:8]
max_entries = int(max_entries)
header = "# build-deploy.log — rolling npm run deploy audit (auto-generated; do not edit)\n\n"

new_block = (
    f"date: {ts}\n"
    f"command: {command}\n"
    f"build: {build_status}\n"
    f"ftp: {ftp_status}\n"
)

p = Path(path)
raw = p.read_text(encoding="utf-8") if p.is_file() else ""
if raw.startswith("#"):
    _, _, raw = raw.partition("\n\n")

parts = [
    chunk.strip("\n")
    for chunk in raw.split(marker)
    if chunk.strip() and not chunk.lstrip().startswith("# build-deploy")
]
parts.append(new_block.strip("\n"))
if len(parts) > max_entries:
    parts = parts[-max_entries:]

entries = "".join(f"{marker}\n{chunk}\n\n" for chunk in parts)
p.write_text(f"{header}{entries}", encoding="utf-8")
PY
}

commit_deploy_log() {
  local push="${DEPLOY_LOG_PUSH:-1}"
  cd "$root"

  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "deploy-log: nincs git repo, commit kihagyva." >&2
    return 0
  fi

  if [[ ! -f "$LOG_PATH" ]]; then
    return 0
  fi

  if git diff --quiet -- "$LOG_FILE" 2>/dev/null && git diff --cached --quiet -- "$LOG_FILE" 2>/dev/null; then
    return 0
  fi

  git add -- "$LOG_FILE"
  if git diff --cached --quiet -- "$LOG_FILE"; then
    return 0
  fi

  local timestamp_short
  timestamp_short="$(date -u +"%Y-%m-%d %H:%M UTC")"
  local msg="chore: update build-deploy log (${timestamp_short})"

  if ! git commit -m "$msg"; then
    echo "deploy-log: commit sikertelen (pl. nincs változás)." >&2
    return 0
  fi

  if [[ "$push" != "1" ]]; then
    echo "deploy-log: commit kész, push kikapcsolva (DEPLOY_LOG_PUSH)." >&2
    return 0
  fi

  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  local attempt=0
  local delay=4
  while (( attempt < 4 )); do
    if git push -u origin "$branch"; then
      echo "deploy-log: log commitolva és pusholva (${branch})." >&2
      return 0
    fi
    attempt=$((attempt + 1))
    if (( attempt < 4 )); then
      echo "deploy-log: push újrapróbálás ${attempt}/3…" >&2
      sleep "$delay"
      delay=$((delay * 2))
    fi
  done

  echo "deploy-log: a push nem sikerült; a commit helyben megvan." >&2
  return 0
}

case "${1:-}" in
  append)
    shift
    append_deploy_log "$@"
    ;;
  commit)
    commit_deploy_log
    ;;
  *)
    echo "Használat: bash scripts/deploy-log.sh append <command> <build> [ftp]" >&2
    echo "           bash scripts/deploy-log.sh commit" >&2
    exit 1
    ;;
esac
