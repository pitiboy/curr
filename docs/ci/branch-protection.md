# `main` branch protection (GitHub)

A [PRD 0002 §4.3](../prd/0002-content-backoffice-v2.md#43-minőségkapu-pre-commit-és-main-branch-protection) szerint a `main`-re közvetlen push tiltott, kötelező CI státuszokkal.

## Kötelező status check nevek

A [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) job **name** mezői (Settings → Branches → Branch protection → Required status checks):

1. **Prettier check**
2. **Typecheck**
3. **Strapi build and tests**
4. **Backoffice lint and tests**

## Beállítás a GitHub UI-ban

1. **Settings** → **Branches** → **Add branch protection rule** (vagy szerkeszd a `main` szabályt).
2. **Require a pull request before merging** — be.
3. **Require status checks to pass** — a fenti négy check.
4. **Require branches to be up to date before merging** — ajánlott.
5. **Do not allow bypassing the above settings** — csapatpolicy szerint.
6. **Restrict who can push to matching branches** — senki (csak merge).
7. **Allow force pushes** — ki.
8. **Allow deletions** — ki.

## `gh` CLI (opcionális)

Ha van admin jogosultság és a repo GitHubon van:

```bash
OWNER=pitiboy
REPO=curr
BRANCH=main

gh api -X PUT "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" \
  -f required_status_checks[strict]=true \
  -f required_status_checks[checks][][context]='Prettier check' \
  -f required_status_checks[checks][][context]='Typecheck' \
  -f required_status_checks[checks][][context]='Strapi build and tests' \
  -f required_status_checks[checks][][context]='Backoffice lint and tests' \
  -f enforce_admins=true \
  -f required_pull_request_reviews[dismiss_stale_reviews]=true \
  -f required_pull_request_reviews[required_approving_review_count]=1 \
  -f restrictions= \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

A pontos `gh api` payload a GitHub API verziótól függ; ha hibázik, használd a UI-t, vagy:

```bash
gh api repos/${OWNER}/${REPO}/branches/${BRANCH}/protection --method GET
```

## Pre-commit (fejlesztői gép)

`npm ci` után a `prepare` script telepíti a [lefthook](https://github.com/evilmartians/lefthook) hookot ([`lefthook.yml`](../../lefthook.yml)): Prettier (staged), oxlint, typecheck, érintett tesztek.

A hook kihagyása (`LEFTHOOK=0 git commit`) **nem** helyettesíti a CI-t.
