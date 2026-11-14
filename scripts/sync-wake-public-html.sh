#!/usr/bin/env bash
# Copy the wake landing page into cPanel public_html templates (repo-only; not deployed with Strapi).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
source_wake="${root}/docs/deploy/wake/index.html"
target_root="${root}/docs/deploy/cpanel/public-html"

mkdir -p "${target_root}/wake"
cp "${source_wake}" "${target_root}/index.html"
cp "${source_wake}" "${target_root}/wake/index.html"
echo "Synced wake HTML → ${target_root}/index.html and ${target_root}/wake/index.html"