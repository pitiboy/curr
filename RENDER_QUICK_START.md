# Redeploy Curr on Render

**Do not delete** `curr-zep-strapi`. Reuse it so you keep the hostname, env vars, and linked Postgres.

The first deploy failed because Root Directory was `apps/backend-strapi` and the branch was `ci/deploy-render-cloud` (Nx + Strapi in a subfolder). Strapi is now the **repo root** on `feat/strapi-monorepo`.

## 1. Point the existing service at the new code

Open [curr-zep-strapi → Settings](https://dashboard.render.com) and save:

| Field | Set to |
| --- | --- |
| **Branch** | `feat/strapi-monorepo` |
| **Root Directory** | **empty** — click Edit and delete `apps/backend-strapi` |
| **Install Command** | `npm ci` (required — Render skipped install and failed with `strapi: not found`) |
| **Build Command** | `npm run build` |
| **Start Command** | `npm start` |
| **Pre-Deploy Command** | empty |
| **Health Check Path** | `/_health` |

After you clear Root Directory, the prompt should look like `$ npm run build`, not `apps/backend-strapi/ $ npm run build`. If there is no Install Command field, set **Build Command** to `npm ci && npm run build`. A good deploy log shows **Installing dependencies** (or `npm ci`) *before* `strapi build`, and takes minutes, not ~7 seconds.

Do **not** create a new Web Service and do **not** apply `render.yaml` (that would create a second app and database).

## 2. Environment

Keep existing secrets if they are already set. Confirm these exist:

```
NODE_VERSION=20
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=1536
HOST=0.0.0.0
DATABASE_CLIENT=postgres
DATABASE_SSL=true
DATABASE_URL=<Internal Database URL, same region as Frankfurt>
IS_PROXIED=true
PUBLIC_URL=https://curr-zep-strapi.onrender.com
APP_KEYS=<four comma-separated keys>
API_TOKEN_SALT
ADMIN_JWT_SECRET
TRANSFER_TOKEN_SALT
JWT_SECRET
ENCRYPTION_KEY
```

Missing secrets:

```bash
node scripts/generate-secrets.js
```

Cloudinary vars only if you use uploads. Optional: `CORS_ORIGINS` for Appsmith.

## 3. Deploy

**Manual Deploy → Deploy latest commit.**

Expect 5–10 minutes. **Free (512 MB) cannot finish `strapi build`.** The admin panel needs ~1 GB of heap. In Settings → upgrade to a **2 GB** plan, set `NODE_OPTIONS=--max-old-space-size=1536`, then Manual Deploy. Raising the heap on Free only gets the process killed by the container.

## 4. Check

- `https://curr-zep-strapi.onrender.com/_health` → 204
- `https://curr-zep-strapi.onrender.com/admin` → create the first admin here

More detail: [RENDER_DEPLOY.md](RENDER_DEPLOY.md).
