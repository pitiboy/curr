# Quick Render Deployment Guide

Deploy your Strapi app to Render in 5 minutes.

## Prerequisites

- GitHub repository with your code
- Render account (sign up at [render.com](https://render.com))

## Step 1: Add Deployment Hooks to package.json

The deployment hooks are already configured. If not, add these to `package.json`:

```json
{
  "scripts": {
    "preinstall": "bash scripts/deploy/preinstall.sh",
    "postinstall": "bash scripts/deploy/postinstall.sh",
    "prebuild": "bash scripts/deploy/prebuild.sh",
    "build": "npx strapi build",
    "start": "npx strapi start"
  }
}
```

## Step 2: Create PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Name it (e.g., `strapi-db`)
4. Select **"Free"** plan
5. Choose your region
6. Click **"Create Database"**
7. **Copy the Internal Database URL** (you'll need it)

## Step 3: Deploy Strapi Web Service

1. In Render Dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure the service:

   **Basic Settings:**

   - **Name:** `backend-strapi` (or any name)
   - **Region:** Same as your database
   - **Branch:** `main` (or your default branch)
   - **Root Directory:** `apps/backend-strapi` ⚠️ **IMPORTANT**
   - **Runtime:** `Node`
   - **Install Command:** `npm install` (optional but recommended so install runs in this directory)
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`

   **Environment Variables:**

   ```
   NODE_ENV=production
   DATABASE_CLIENT=postgres
   DATABASE_URL=<paste-internal-database-url-from-step-2>
   APP_KEYS=<generate-4-random-strings-separated-by-commas>
   API_TOKEN_SALT=<random-string>
   ADMIN_JWT_SECRET=<random-string>
   TRANSFER_TOKEN_SALT=<random-string>
   JWT_SECRET=<random-string>
   ```

   **Generate Secrets:**

   ```bash
   # Quick way - run this script:
   node scripts/generate-secrets.js

   # Or manually generate:
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   # Run 4 times for APP_KEYS (comma-separated)
   # Run once each for API_TOKEN_SALT, ADMIN_JWT_SECRET, TRANSFER_TOKEN_SALT, JWT_SECRET
   ```

   **Cloudinary (if using):**

   ```
   CLOUDINARY_NAME=<your-cloudinary-name>
   CLOUDINARY_KEY=<your-cloudinary-key>
   CLOUDINARY_SECRET=<your-cloudinary-secret>
   CLOUDINARY_UPLOAD_PRESET=<your-preset>
   CLOUDINARY_FOLDER=strapi-uploads
   ```

4. Click **"Create Web Service"**

## Step 4: Wait for Deployment

- First deployment takes 5-10 minutes
- Watch the logs for any errors
- Service will be available at `https://your-app-name.onrender.com`

## Step 5: Access Strapi Admin

1. Go to `https://your-app-name.onrender.com/admin`
2. Create your admin account
3. Start using Strapi!

## Step 6: Prevent Cold Starts (Optional but Recommended)

1. Sign up at [UptimeRobot.com](https://uptimerobot.com) (free)
2. Add new monitor:
   - **Type:** HTTP(s)
   - **URL:** `https://your-app-name.onrender.com/api/users-permissions/roles`
   - **Interval:** 5 minutes
3. This keeps your service warm 24/7

## Troubleshooting

### `strapi: not found` / Build fails

- **Root Directory must be `apps/backend-strapi`** so Render runs `npm install` and `npm run build` inside the Strapi app (not the repo root). In Dashboard → your Web Service → **Settings**, set **Root Directory** to exactly `apps/backend-strapi`.
- Set **Install Command** to `npm install` so dependencies are installed in that directory.
- The repo root is an Nx/pnpm monorepo; Strapi is only installed when the project root is `apps/backend-strapi`.

### Other build failures

- Check logs in Render dashboard
- Verify all environment variables are set

### Database Connection Fails

- Use **Internal Database URL** (not External)
- Check `DATABASE_URL` environment variable
- Ensure database is in same region as web service

### Service Won't Start

- Check `NODE_ENV=production` is set
- Verify all required environment variables
- Check logs for specific errors

## Quick Checklist

- [ ] PostgreSQL database created
- [ ] Web service created with correct root directory
- [ ] All environment variables set
- [ ] Build command: `npm run build`
- [ ] Start command: `npm start`
- [ ] UptimeRobot monitor set up (optional)

## Your App URLs

- **Web Service:** `https://your-app-name.onrender.com`
- **Admin Panel:** `https://your-app-name.onrender.com/admin`
- **API:** `https://your-app-name.onrender.com/api`

---

**That's it!** Your Strapi app should now be live on Render. 🚀


