#!/usr/bin/env bash
# Redact postgres URIs and common secret patterns from log lines on stdin.
set -euo pipefail

sanitize_stream() {
  sed -E \
    -e 's#(postgres(ql)?://)[^:@/]+(:[^@/]+)?@#\1***:***@#gi' \
    -e 's#@[a-zA-Z0-9._-]+\.[a-zA-Z0-9.-]+#@***.host#' \
    -e 's/(password|passwd|pwd)([[:space:]]*[=:][[:space:]]*)[^[:space:]"'\'']+/\1\2***/gi' \
    -e 's/PGPASSWORD=[^[:space:]]+/PGPASSWORD=***/g' \
    -e 's/NEON_BACKUP_DATABASE_URL(_[0-9]+)?=[^[:space:]]+/NEON_BACKUP_DATABASE_URL\1=***/g'
}

sanitize_stream
