#!/usr/bin/env bash
# Optional EXIT trap: log FTP outcome when DEPLOY_LOG_COMMAND is set (direct deploy:* npm scripts).
if [[ -n "${DEPLOY_LOG_COMMAND:-}" ]]; then
  _ftp_deploy_log_root="${_ftp_deploy_log_root:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
  _ftp_deploy_log_script="$_ftp_deploy_log_root/scripts/deploy-log.sh"

  _ftp_deploy_log_on_exit() {
    local st=$?
    local ftp_label="failed (exit ${st})"
    if [[ "$st" -eq 0 ]]; then
      ftp_label="success"
    fi
    bash "$_ftp_deploy_log_script" append "$DEPLOY_LOG_COMMAND" "success" "$ftp_label" || true
    bash "$_ftp_deploy_log_script" commit || true
    if [[ "$DEPLOY_LOG_COMMAND" == *deploy* && "$DEPLOY_LOG_COMMAND" != *backoffice* ]]; then
      DEPLOY_DEPS_BASELINE=previous bash "$_ftp_deploy_log_root/scripts/deploy-strapi-deps.sh" warn-if-changed || true
    fi
    trap - EXIT
    exit "$st"
  }

  trap _ftp_deploy_log_on_exit EXIT
fi
