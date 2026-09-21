# Render Deployment Guide

Deploy Curr (Strapi 5) from the **repository root**. There is no `apps/backend-strapi` Root Directory anymore.

## Prerequisites

- GitHub repository with this code on the branch Render tracks
- Render account

## Option A: Blueprint (`render.yaml`)

1. Run `node scripts/generate-secrets.js` and keep the output.
2. In Render: **New +** → **Blueprint** → this repo.
3. Confirm the web service and `curr-strapi-db` Postgres instance.
4. Fill every `sync: false` env var (secrets, `PUBLIC_URL`, `CORS_ORIGINS`, Cloudinary). Do **not** use Render `generateValue` for `APP_KEYS` — Strapi needs four comma-separated keys.
5. Set `PUBLIC_URL` to `https://<service>.onrender.com` after the hostname exists.

If you already have a Render Postgres instance with data, **do not** apply the Blueprint in a way that creates a second database. Use Option B and keep the existing DB.

## Option B: Dashboard

### 1. PostgreSQL

1. **New +** → **PostgreSQL**
2. Same region as the web service
3. Copy the **Internal** Database URL

### 2. Web service

1. **New +** → **Web Service** → this repo
2. Configure:

   - **Name:** `curr-strapi` (or existing service name)
   - **Region:** same as the database
   - **Branch:** `main` (or your default)
   - **Root Directory:** **empty** (must not be `apps/backend-strapi`)
   - **Runtime:** Node
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/_health`

   Render installs from `package-lock.json` at the repo root (`npm ci` / `npm install`).

### 3. Environment variables

Required:

```
NODE_VERSION=20
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=512
HOST=0.0.0.0
DATABASE_CLIENT=postgres
DATABASE_SSL=true
DATABASE_URL=<internal-database-url>
IS_PROXIED=true
PUBLIC_URL=https://<your-service>.onrender.com
APP_KEYS=<four-base64-keys-comma-separated>
API_TOKEN_SALT=<random>
ADMIN_JWT_SECRET=<random>
TRANSFER_TOKEN_SALT=<random>
JWT_SECRET=<random>
ENCRYPTION_KEY=<random>
```

Generate secrets:

```bash
node scripts/generate-secrets.js
```

Cloudinary (if using uploads):

```
CLOUDINARY_NAME=<name>
CLOUDINARY_KEY=<key>
CLOUDINARY_SECRET=<secret>
CLOUDINARY_UPLOAD_PRESET=<preset>
CLOUDINARY_FOLDER=strapi-uploads
```

Optional CORS for Appsmith / other frontends:

```
CORS_ORIGINS=https://your-appsmith.example.com
```

Set env vars **before** the first successful production start. Config is loaded at boot (and some of it at build).

## Existing service cutover

If this app was previously deployed with Root Directory `apps/backend-strapi`:

1. Deploy the branch where Strapi is at the repo root.
2. In **Settings**, clear **Root Directory**.
3. Keep the existing Postgres instance and `DATABASE_URL`.
4. Add any missing vars (`ENCRYPTION_KEY`, `PUBLIC_URL`, `IS_PROXIED`, `DATABASE_SSL`).
5. Trigger a **manual deploy**. Do not create a second database unless you intend to migrate data.

## After deploy

- Health: `https://<service>.onrender.com/_health`
- Admin: `https://<service>.onrender.com/admin` — create the first admin only on the live site
- API: `https://<service>.onrender.com/api`

Optional: UptimeRobot (or similar) on `/_health` every 5 minutes to reduce free-tier cold starts.

## Troubleshooting

### `strapi: not found`

Install ran in the wrong directory. Root Directory must be empty so `package.json` at the repo root (with `@strapi/strapi`) is installed.

### Build killed / OOM

The admin build is memory-heavy. Raise the instance, and keep `NODE_OPTIONS=--max-old-space-size=512` (or `768` on larger plans).

### Database connection fails

- Use the **Internal** URL, same region
- `DATABASE_CLIENT=postgres` is set automatically when `DATABASE_URL` is present, but keep it explicit
- Production enables SSL by default (`DATABASE_SSL=true`)

### Admin login / cookies fail over HTTPS

- `IS_PROXIED=true` (default when `NODE_ENV=production`)
- `PUBLIC_URL` must be the public `https://…` origin

### Missing `ENCRYPTION_KEY`

Strapi 5 admin config requires it. Generate with `node scripts/generate-secrets.js`.

Reproduce locally:

```bash
NODE_ENV=production npm run build && npm start
```
