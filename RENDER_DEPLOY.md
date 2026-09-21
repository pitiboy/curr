# Render deployment

Reuse the existing **curr-zep-strapi** service. Do not delete it and do not click **New +** unless you want a new URL and a new database.

## What went wrong last time

| Setting then | Required now |
| --- | --- |
| Branch `ci/deploy-render-cloud` (Nx monorepo) | `feat/strapi-monorepo` (Strapi at repo root) |
| Root Directory `apps/backend-strapi` | **empty** |
| Build ran in the subfolder | `$ npm run build` at repo root |

## Redeploy the failed service

1. Push is already on `origin/feat/strapi-monorepo`.
2. Dashboard → **curr-zep-strapi** → **Settings**:
   - **Branch:** `feat/strapi-monorepo`
   - **Root Directory:** clear `apps/backend-strapi` (leave blank)
   - **Install Command:** `npm ci`
   - **Build Command:** `npm run build` (or `npm ci && npm run build` if there is no Install field)
   - **Start Command:** `npm start`
   - **Pre-Deploy Command:** blank
   - **Health Check Path:** `/_health`
3. **Environment** — keep the linked Postgres **Internal** URL. Add any missing vars from the list below. Do not rotate `APP_KEYS` / JWT secrets if an admin already exists.
4. **Manual Deploy** → **Deploy latest commit**.

Skip `render.yaml` for this cutover. A Blueprint would create another web service (`curr-strapi`) and another database.

## Environment

```
NODE_VERSION=20
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=1536
HOST=0.0.0.0
DATABASE_CLIENT=postgres
DATABASE_SSL=true
DATABASE_URL=<Internal URL, Frankfurt>
IS_PROXIED=true
PUBLIC_URL=https://curr-zep-strapi.onrender.com
APP_KEYS=<four keys, comma-separated>
API_TOKEN_SALT
ADMIN_JWT_SECRET
TRANSFER_TOKEN_SALT
JWT_SECRET
ENCRYPTION_KEY
```

```bash
node scripts/generate-secrets.js
```

Optional: Cloudinary (`CLOUDINARY_*`), `CORS_ORIGINS`.

## After it is live

- Health: `https://curr-zep-strapi.onrender.com/_health`
- Admin: `https://curr-zep-strapi.onrender.com/admin`
- API: `https://curr-zep-strapi.onrender.com/api`

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `strapi: not found` in ~7s | Install never ran. Set **Install Command** to `npm ci` (or Build to `npm ci && npm run build`). Logs must show a dependency install before `strapi build`. |
| `JavaScript heap out of memory` / **Killed** | Admin build needs more than 512 MB. Upgrade to **2 GB**, set `NODE_OPTIONS=--max-old-space-size=1536`. Do not keep heap at 512 on Free. |
| DB connection errors | Use **Internal** `DATABASE_URL`, same region (Frankfurt) |
| Admin cookies fail on HTTPS | `IS_PROXIED=true` and `PUBLIC_URL=https://curr-zep-strapi.onrender.com` |
| Missing `ENCRYPTION_KEY` | Generate and set it before boot |

Local reproduce: `NODE_ENV=production npm run build && npm start`
