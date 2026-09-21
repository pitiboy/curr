# Fly + Neon production (Path 1)

Year-1 production path for this Strapi 5.27 API. Treasurers use **Strapi Admin**. Do not point DBeaver at these tables.

This file is the **human runbook** (console clicks + CLI). The agent prompt is [`docs/ci/deploy.neon.fly.io.md`](docs/ci/deploy.neon.fly.io.md). Do not create Neon or Fly resources from an agent session unless asked.

**Last checked:** 2026-09-21. Vendor UI labels change; if a button is missing, use the cited docs.

| Piece | Locked choice |
| --- | --- |
| API | Fly Machine, region **`fra`**, 1 GB, autostop |
| Database | Neon Postgres, **`aws-eu-central-1`** (Frankfurt), **pooled** URL |
| Deploy | Push branch **`deploy/fly`** → GitHub Actions → GHCR → `flyctl deploy` |
| Not this path | Fly Postgres / MPG, Neon Data API as the app, Render, tárhely |

Leave `curr-zep-strapi` on Render and tárhely **untouched**. Do not apply [`render.yaml`](render.yaml).

---

## What git already has

- [`Dockerfile`](Dockerfile) — CI builds the admin (`strapi build`). Runtime only `npm start`.
- [`fly.toml`](fly.toml) — `fra`, 1 GB, `auto_stop_machines = "stop"`, health **`/_health`**. App name default **`curr-strapi`** (change it if the Fly app name differs).
- [`.github/workflows/deploy-fly.yml`](.github/workflows/deploy-fly.yml) — runs on **`deploy/fly`**.
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — PR/`main` typecheck + sqlite build (unchanged).

You still have to create the Neon project, the Fly app, and GitHub secrets. This runbook does **not** migrate Render data on the first experiment.

---

## 1. Neon Console

Docs: [Create a project](https://neon.com/docs/manage/projects) · [Regions](https://neon.com/docs/introduction/regions) · [Connection pooling](https://neon.com/docs/connect/connection-pooling)

### Sign up / org

1. Open [https://console.neon.tech](https://console.neon.tech) and sign in.
2. If asked for a plan, **Free** is enough for year-1 idle use (0.5 GB storage, compute sleeps; **data is kept**).

### New project (region is permanent)

1. Click **New Project**.
2. **Project name:** e.g. `curr` (≤64 characters).
3. **Postgres version:** **16** or **17** (Strapi 5 needs PostgreSQL ≥ 14). Do **not** pick anything below 14.
4. **Cloud service provider:** **AWS**.
5. **Region:** **Europe (Frankfurt)** — id **`aws-eu-central-1`**. This cannot be changed later.
6. Click **Create Project**.

Do **not** enable **Neon Data API** / PostgREST for this app. Strapi is the API.

### Copy the pooled connection string

1. On the **Project Dashboard**, click **Connect**.
2. Choose **Branch** (default `main`), **Compute**, **Database**, **Role** (the owner role is fine for year-1 Strapi; Super Admin ≡ full DB).
3. Turn **Connection pooling** **ON** (default for new projects). The hostname must contain **`-pooler`**.
4. Copy the URL. A **pooled** URL looks like:

   `postgresql://USER:PASSWORD@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`

   The hostname **must** contain **`-pooler`**. If it does not, the toggle is off (that string is the direct endpoint — keep it for later `pg_dump` only).

### Do not

- Do not turn on **IP Allow** for the first experiment (Fly egress IPs are not a stable allowlist).
- Do not migrate Render / `curr-zep-strapi` data yet.
- Do not use this database as a Path 2 Data API backend.

Optional check: **Settings** on the dashboard should show region **AWS Frankfurt** / `aws-eu-central-1`. Compute may show scale-to-zero (~5 minutes idle). Sleep does **not** delete storage.

---

## 2. Fly.io dashboard and CLI

Docs: [Create an app](https://fly.io/docs/launch/create/) · [fly.toml](https://fly.io/docs/reference/configuration/) · [Autostop](https://fly.io/docs/reference/fly-proxy-autostop-autostart/) · [Access tokens](https://fly.io/docs/security/tokens/) · [Pricing / trial](https://fly.io/docs/about/free-trial/)

### Account, card, region

1. Open [https://fly.io/dashboard](https://fly.io/dashboard) and sign up or log in.
2. Add a **payment card** when asked. New orgs have **no** free compute allowance; the trial is about **2 hours or 7 days**. Autostop means you pay RAM/CPU only while the Machine is running (~$0–8/month at 1–2 CRUD/day, or ~$8/month if you leave 1 GB always-on).
3. Confirm you can create apps in **`fra`** (Frankfurt).

### Create the app — do not add Fly Postgres

**Dashboard**

1. **Launch** / **Create app** (or **New App**).
2. App name: **`curr-strapi`** (must match `app` in [`fly.toml`](fly.toml); if you pick another name, edit `fly.toml` and `--app` in the workflow).
3. **Primary region: Frankfurt (`fra`)**.
4. **Skip** / do **not** provision **Fly Postgres**, **Managed Postgres (MPG)**, or Redis. Database is Neon.

**CLI (same outcome)**

```bash
fly auth login
fly apps create curr-strapi --org <your-org>
```

Do not run `fly launch` in a way that generates a new Dockerfile or attaches MPG. Config is already in git.

### Secrets (required before the first deploy)

From the repo root, after `node scripts/generate-secrets.js`:

```bash
fly secrets set -a curr-strapi \
  DATABASE_URL='postgresql://USER:PASSWORD@ep-XXX-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require' \
  DATABASE_SSL=true \
  DATABASE_SSL_REJECT_UNAUTHORIZED=false \
  DATABASE_POOL_MIN=0 \
  NODE_ENV=production \
  HOST=0.0.0.0 \
  IS_PROXIED=true \
  PUBLIC_URL=https://curr-strapi.fly.dev \
  APP_KEYS='key1,key2,key3,key4' \
  API_TOKEN_SALT='…' \
  ADMIN_JWT_SECRET='…' \
  TRANSFER_TOKEN_SALT='…' \
  JWT_SECRET='…' \
  ENCRYPTION_KEY='…'
```

Use your real Fly hostname if it is not `curr-strapi.fly.dev` (`fly status -a curr-strapi`).

**Dashboard alternative:** open the app → **Secrets** → **Set** each key. Never paste secrets into git.

### Cloudinary (when receipts go live)

Copy from the Render service if it already works:

```bash
fly secrets set -a curr-strapi \
  CLOUDINARY_NAME='…' \
  CLOUDINARY_KEY='…' \
  CLOUDINARY_SECRET='…' \
  CLOUDINARY_FOLDER=strapi-uploads
```

Optional: `CLOUDINARY_UPLOAD_PRESET`.

### Deploy token for GitHub Actions

Do **not** use `fly auth token` (short-lived personal token).

**CLI (preferred)**

```bash
fly tokens create deploy -a curr-strapi --name "github-actions deploy/fly"
```

**Dashboard**

1. Open the **`curr-strapi`** app.
2. Click **Tokens**.
3. **Create** an app-scoped deploy token, name it e.g. `github-actions`.
4. Copy it **once**.

Org-wide: org dropdown → **Tokens** → create org token (broader than needed).

---

## 3. GitHub website

### Actions secret

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**.
3. Name: **`FLY_API_TOKEN`** (must match [`.github/workflows/deploy-fly.yml`](.github/workflows/deploy-fly.yml)).
4. Value: the Fly deploy token from the previous section.

`GITHUB_TOKEN` is automatic. The workflow already has `permissions.packages: write` for GHCR.

### GHCR

The first successful `deploy/fly` run publishes `ghcr.io/<owner>/<repo>`.

1. After a green build, **Packages** (repo right sidebar or `https://github.com/orgs/<org>/packages`).
2. If the package is private, Fly still deploys because the workflow **pulls the image on the runner** and uses `flyctl deploy --local-only` (uploads to Fly’s registry). You do not need a public package.
3. Org repos: if `GITHUB_TOKEN` cannot push packages, org **Settings** → **Actions** → **General** → workflow permissions: allow read/write, and allow Actions to create GHCR packages.

### Special branch

```bash
git checkout -b deploy/fly
git push -u origin deploy/fly
```

Pushing this branch runs **Deploy Fly**. `main` / PRs only run the sqlite CI job.

If the Fly app name is not `curr-strapi`, edit `app` in `fly.toml` **and** `--app` in the workflow before pushing.

---

## 4. First experiment (after deploy)

Cold start is expected (Fly Machine boot + Strapi + Neon wake). Hit twice:

1. `https://<app>.fly.dev/_health`
2. `https://<app>.fly.dev/admin`
3. Repeat both (warm).

Then in Admin:

1. Create the first **Super Admin** (only if the DB is empty).
2. **Settings → Administration Panel → Roles:** add **Treasurer** — Content Manager on transaction / receipt / member; read on accounts and types; **no** Content-Type Builder. Do not invite members as Admin.
3. **Settings → Users & Permissions → Roles → Public:** **`find` and `create` off** on `transaction`, `member`, and every ledger collection type. Re-check after every deploy.

Do **not** `npm run seed:full` until you confirm this Neon project is empty and you intend to seed it. Do **not** use DBeaver as the treasurer UI (Strapi document / `_lnk` tables).

---

## 5. Operator checklist

1. Neon project in **`aws-eu-central-1`**, **pooled** `-pooler` URL copied.
2. Fly app **`curr-strapi`** in **`fra`**, **no** Fly Postgres, card on file.
3. `fly secrets set` (Strapi secrets + `DATABASE_URL` + `PUBLIC_URL`).
4. GitHub secret **`FLY_API_TOKEN`**.
5. Push **`deploy/fly`**. Workflow green. `/_health` and `/admin` twice.
6. Super Admin, then Treasurer role; Public CRUD off.
7. Cloudinary secrets when attaching receipts.
8. `seed:full` only on an approved empty Neon (days 14–30).

---

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| Deploy: `app not found` | Create the Fly app first; `app` in `fly.toml` and `--app` in the workflow must match. |
| `FLY_API_TOKEN` unauthorized | Use `fly tokens create deploy`, not `fly auth token`. |
| Health check fail / long deploy | First boot can exceed a short grace period; [`fly.toml`](fly.toml) uses **90s**. Neon may still be waking. |
| Admin cookies fail on HTTPS | `IS_PROXIED=true` and `PUBLIC_URL=https://<app>.fly.dev`. |
| DB connect errors | Pooled URL, `DATABASE_SSL=true`, hostname contains `-pooler`. |
| Machine OOM at runtime | First experiment stays on **1 GB**. If RSS dies, bump per hosting doc (1.5–2 GB) and say why. |
| `strapi: not found` in image | Image must run `npm ci` in the Docker **build** stage (already in [`Dockerfile`](Dockerfile)). |

Local image check (optional, not required): `docker build --platform linux/amd64 -t curr-strapi:local .`

---

## Sources

- Neon projects / regions / pooling: https://neon.com/docs/manage/projects · https://neon.com/docs/introduction/regions · https://neon.com/docs/connect/connection-pooling
- Fly launch / config / autostop / tokens / GitHub Actions: https://fly.io/docs/launch/create/ · https://fly.io/docs/reference/configuration/ · https://fly.io/docs/reference/fly-proxy-autostop-autostart/ · https://fly.io/docs/security/tokens/ · https://fly.io/docs/flyctl/integrating/
- Path 1 ADR: [`docs/backend-strategy-comparison.md`](docs/backend-strategy-comparison.md)
- Hosting pick: [`docs/cloud-provider-comparison.md`](docs/cloud-provider-comparison.md)
