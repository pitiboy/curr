#!/usr/bin/env bash
# Book a deploy result in GitHub Environments / Deployments.
# Requires: gh CLI, GITHUB_TOKEN with deployments:write, GITHUB_REPOSITORY, GITHUB_SHA.
set -euo pipefail

state="${1:-}"
targets="${2:-unknown}"
if [[ -z "$state" || ( "$state" != "success" && "$state" != "failure" ) ]]; then
  echo "Használat: bash scripts/deploy/record-github-deployment.sh <success|failure> [targets]" >&2
  exit 1
fi

# gh accepts GH_TOKEN or GITHUB_TOKEN; Actions often sets only the former in steps.
export GITHUB_TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN vagy GH_TOKEN szükséges}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY szükséges}"
: "${GITHUB_SHA:?GITHUB_SHA szükséges}"


export DEPLOY_GITHUB_ENVIRONMENT="${DEPLOY_GITHUB_ENVIRONMENT:-KOR.fejlesztesek.hu}"
export DEPLOY_BASE_URL="${DEPLOY_BASE_URL:-https://kor.fejlesztesek.hu}"
export DEPLOY_RECORD_STATE="$state"
export DEPLOY_RECORD_TARGETS="$targets"
export DEPLOY_RECORD_RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID:-}"
export DEPLOY_RECORD_DESC="CI deploy ${state}: ${targets} @ ${GITHUB_SHA:0:7}"

deployment_id="$(
  python3 - <<'PY' | gh api --method POST "repos/${GITHUB_REPOSITORY}/deployments" --input - --jq .id
import json, os

print(
    json.dumps(
        {
            "ref": os.environ["GITHUB_SHA"],
            "environment": os.environ["DEPLOY_GITHUB_ENVIRONMENT"],
            "auto_merge": False,
            "required_contexts": [],
            "description": os.environ["DEPLOY_RECORD_DESC"][:1024],
            "production_environment": True,
            "transient_environment": False,
        }
    )
)
PY
)"

if [[ -z "$deployment_id" || "$deployment_id" == "null" ]]; then
  echo "record-github-deployment: deployment létrehozás sikertelen." >&2
  exit 1
fi

python3 - <<'PY' | gh api --method POST "repos/${GITHUB_REPOSITORY}/deployments/${deployment_id}/statuses" --input - >/dev/null
import json, os

print(
    json.dumps(
        {
            "state": os.environ["DEPLOY_RECORD_STATE"],
            "description": os.environ["DEPLOY_RECORD_DESC"][:140],
            "environment": os.environ["DEPLOY_GITHUB_ENVIRONMENT"],
            "environment_url": os.environ["DEPLOY_BASE_URL"],
            "log_url": os.environ["DEPLOY_RECORD_RUN_URL"],
            "auto_inactive": True,
        }
    )
)
PY

echo "GitHub Deployment #${deployment_id} → ${state} (${targets} @ ${GITHUB_SHA:0:7})"
echo "Environment: ${DEPLOY_GITHUB_ENVIRONMENT} — ${DEPLOY_RECORD_RUN_URL}"
