# Render Quick Start

Strapi lives at the **repository root**. Do not set a Root Directory.

## 1. Generate secrets

```bash
node scripts/generate-secrets.js
```

Copy every line into the Render dashboard (or Blueprint `sync: false` vars). Include `ENCRYPTION_KEY`.

## 2. PostgreSQL

1. [Render Dashboard](https://dashboard.render.com) → **New +** → **PostgreSQL**
2. Same region as the web service
3. Copy the **Internal** Database URL (not External)

## 3. Web service

1. **New +** → **Web Service** → this GitHub repo
2. Settings:
   - **Root Directory:** leave **empty**
   - **Runtime:** Node
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Instance:** enough RAM for `strapi build` (512MB often OOMs; 1GB+ is safer)
3. Environment:

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
   ```

   Plus the secrets from step 1, and Cloudinary vars if you use uploads.
   Optional: `CORS_ORIGINS=https://your-appsmith.example.com`

4. Create the service (or use [render.yaml](render.yaml) as a Blueprint)

## 4. Admin

- Health: `https://<your-service>.onrender.com/_health`
- Admin: `https://<your-service>.onrender.com/admin` — create the first user here, never commit it

Or skip the dashboard and apply [render.yaml](render.yaml); still set the `sync: false` secrets before the first deploy. See [RENDER_DEPLOY.md](RENDER_DEPLOY.md) for cutover and troubleshooting.
