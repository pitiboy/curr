#!/usr/bin/env bash
# Track root package.json dependencies across Strapi FTPS deploys; warn when they changed.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
STATE_FILE="${DEPLOY_STRAPI_DEPS_STATE:-build-deploy.strapi-deps}"
STATE_PATH="$root/$STATE_FILE"
PKG="$root/package.json"

fingerprint_dependencies() {
  PKG_PATH="$PKG" node <<'NODE'
const fs = require("fs");
const crypto = require("crypto");
const pkgPath = process.env.PKG_PATH;
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const deps = pkg.dependencies || {};
const keys = Object.keys(deps).sort();
const normalized = keys.map((k) => `${k}=${String(deps[k])}`).join("\n");
console.log(crypto.createHash("sha256").update(normalized).digest("hex"));
NODE
}

warn_if_dependencies_changed_since_last_deploy() {
  if [[ ! -f "$PKG" ]]; then
    echo "deploy-strapi-deps: nincs package.json" >&2
    return 0
  fi

  local current previous
  current="$(fingerprint_dependencies)"

  if [[ ! -f "$STATE_PATH" ]]; then
    printf '%s\n' "$current" >"$STATE_PATH"
    return 0
  fi

  previous="$(tr -d '[:space:]' <"$STATE_PATH")"
  if [[ -z "$previous" ]]; then
    printf '%s\n' "$current" >"$STATE_PATH"
    return 0
  fi

  if [[ "$current" != "$previous" ]]; then
    printf '\n\033[1;31m%s\033[0m\n' \
      "FIGYELEM: a package.json dependencies (Strapi) megváltozott az utolsó sikeres deploy óta." >&2
    printf '\033[1;31m%s\033[0m\n\n' \
      "A szerveren NPM Install szükséges (majd alkalmazás újraindítás)." >&2
  fi

  printf '%s\n' "$current" >"$STATE_PATH"
}

case "${1:-}" in
  fingerprint)
    fingerprint_dependencies
    ;;
  warn-if-changed)
    warn_if_dependencies_changed_since_last_deploy
    ;;
  *)
    echo "Használat: bash scripts/deploy-strapi-deps.sh fingerprint|warn-if-changed" >&2
    exit 1
    ;;
esac
