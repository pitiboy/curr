# Curr

Community Unified Resource Registry — Strapi 5 API at the repository root.

Sidecar folders (not part of the Node app): `docs/`, `apps/frontend-appsmith/`, `apps/cost-planner/`.

Year-1 backend is Path 1 ([`docs/backend-strategy-comparison.md`](docs/backend-strategy-comparison.md)); hosting is Neon FRA + Fly `fra` ([`docs/cloud-provider-comparison.md`](docs/cloud-provider-comparison.md)).

## Requirements

- Node.js 20 (`nvm use` reads `.nvmrc`)
- npm 10+
- Docker (optional, for local Postgres)

## Local development

```bash
cp .env.example .env
node scripts/generate-secrets.js   # paste values into .env
npm ci
npm run docker:dev                 # Postgres only
npm run develop                    # Strapi at http://localhost:1337
```

Use sqlite by leaving `DATABASE_URL` unset and `DATABASE_CLIENT=sqlite`, or point `.env` at the Docker Postgres service.

```bash
npm run build      # production admin build
npm start          # production server (no auto-reload)
npm run typecheck
```

## Production (Fly + Neon)

Year-1 production is **Fly.io `fra` + Neon Postgres Frankfurt**. See [FLY_DEPLOY.md](FLY_DEPLOY.md).

Do not apply [render.yaml](render.yaml) (it would create a second web service and database). Leave the existing Render service `curr-zep-strapi` untouched.

## Render (rollback)

Known-working paid RAM path, not the year-1 plan. See [RENDER_QUICK_START.md](RENDER_QUICK_START.md) and [RENDER_DEPLOY.md](RENDER_DEPLOY.md). Root Directory must be empty — this package is the repo root.

## Seed data

```bash
npm run seed:help
```
