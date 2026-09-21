# CURR (this repository)

Strapi **5.27** API at the **repository root** (`package.json` name `backend-strapi`). Node 20–22. REST only. Year-1 UI is **Strapi Admin**.

## Path 1 (locked ~12 months)

Postgres on **Neon Frankfurt** (`aws-eu-central-1`). Node on **Fly.io `fra`**. Later custom client talks to Strapi REST — do not design it unless the user reopens [`docs/backend-strategy-comparison.md`](docs/backend-strategy-comparison.md).

- Human deploy: [`FLY_DEPLOY.md`](FLY_DEPLOY.md)
- Agent prompt: [`docs/ci/deploy.neon.fly.io.md`](docs/ci/deploy.neon.fly.io.md)
- Hosting ADR: [`docs/cloud-provider-comparison.md`](docs/cloud-provider-comparison.md)

Local: Docker Postgres 16 (`npm run docker:dev`) + `npm run develop`. Production is Neon, not Compose.

## Refuse unless the user explicitly reopens the ADR

Path 2 (drop Strapi, Neon Data API / PostgREST / Supabase as the app). GraphQL plugin. Custom client, member self-serve, CSV import, scheduled fees. DBeaver as treasurer UI. Applying [`render.yaml`](render.yaml). Fly Postgres / MPG. Committing `.env` or deploy tokens.

Sidecars `apps/frontend-appsmith/`, `apps/cost-planner/`, leftover `apps/backend-strapi/` are not the production app.
