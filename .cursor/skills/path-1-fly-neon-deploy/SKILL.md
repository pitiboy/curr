---
name: path-1-fly-neon-deploy
description: >-
  Deploys and documents the Path 1 Strapi API on Fly.io fra with Neon
  Frankfurt Postgres (pooled URL, GHCR image, autostop). Use when the user
  mentions Fly, Neon, GHCR, deploy/fly, FLY_DEPLOY, first experiment, or
  production hosting for this repo.
---

# Path 1 Fly + Neon deploy

## Read first

- [`FLY_DEPLOY.md`](../../../FLY_DEPLOY.md) — human console + CLI steps
- [`docs/ci/deploy.neon.fly.io.md`](../../../docs/ci/deploy.neon.fly.io.md) — agent cutover prompt
- [`fly.toml`](../../../fly.toml), [`Dockerfile`](../../../Dockerfile), [`.github/workflows/deploy-fly.yml`](../../../.github/workflows/deploy-fly.yml)

## Split work

| Who | Does |
| --- | --- |
| Agent | Dockerfile, `fly.toml`, workflows, `DATABASE_POOL_MIN`, docs. No secrets in git. |
| Human | Neon project, Fly app + card, `fly secrets set`, GitHub `FLY_API_TOKEN`, push `deploy/fly` |

Do **not** create Neon or Fly resources, run `fly launch`, or `seed:full` unless the user explicitly asks.

## Invariants

- Image built in CI (`linux/amd64`), runtime `npm start` only
- Region `fra`, 1 GB, autostop `stop`, min machines 0, health `/_health`
- `DATABASE_URL` is Neon **pooled** (`-pooler`); SSL on; pool min 0–1
- No Fly Postgres/MPG, no Neon Data API, no GraphQL, no DBeaver as treasurer UI
- Do not apply `render.yaml`

If the user asks for website steps, quote `FLY_DEPLOY.md` (Neon Connect pooling toggle, Fly Tokens, GitHub Actions secret). Do not invent a second host.
