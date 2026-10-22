#!/usr/bin/env bash
# Strapi deploy után: dependencies változás git + build-deploy.log alapján.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

case "${1:-}" in
  warn-if-changed)
    node "$root/scripts/deploy-strapi-deps-check.mjs"
    ;;
  *)
    echo "Használat: bash scripts/deploy-strapi-deps.sh warn-if-changed" >&2
    exit 1
    ;;
esac
