# 🚀 Render Quick Start (5 Minutes)

## 1. Generate Secrets

```bash
cd apps/backend-strapi
node scripts/generate-secrets.js
```

Copy the output to use in Step 3.

## 2. Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. **New +** → **PostgreSQL**
3. Name: `strapi-db`
4. Plan: **Free**
5. **Create Database**
6. Copy **Internal Database URL**

## 3. Deploy Web Service

1. **New +** → **Web Service**
2. Connect GitHub repo
3. Settings:
   - **Root Directory:** `apps/backend-strapi` ⚠️
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
4. Environment Variables:

   ```
   NODE_ENV=production
   DATABASE_URL=<paste-internal-database-url>
   ```

   - Paste secrets from Step 1

5. **Create Web Service**

## 4. Access Your App

- Admin: `https://your-app.onrender.com/admin`
- API: `https://your-app.onrender.com/api`

## 5. Keep It Warm (Optional)

- Sign up at [UptimeRobot.com](https://uptimerobot.com)
- Monitor: `https://your-app.onrender.com/api/users-permissions/roles`
- Interval: 5 minutes

**Done!** 🎉


