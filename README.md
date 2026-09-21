# Curr

Community Unified Resource Registry — Strapi 5 API at the repository root.

Sidecar folders (not part of the Node app): `docs/`, `apps/frontend-appsmith/`, `apps/cost-planner/`.

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

## Render

See [RENDER_QUICK_START.md](RENDER_QUICK_START.md) and [RENDER_DEPLOY.md](RENDER_DEPLOY.md). Root Directory must be empty — this package is the repo root.

## Seed data

```bash
npm run seed:help
```
