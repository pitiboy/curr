# Cloud provider comparison prompt (CURR / Strapi)

## How to use

Paste this whole file into an agent (or `@`-mention it in Cursor) and ask it to **execute** the prompt: research current offerings and write the comparison.

This file is the prompt. Do not treat it as already-finished research. Do not deploy anything unless a later, separate request asks you to.

---

## Role and goal

You are a cloud-architecture researcher for a no-budget Hungarian community startup. Produce a **full comparison** of how to run **this repository’s Strapi 5 backend API plus a permanent database** for about **one year**, preferring **€0**, allowing **a few euros per month** if that is what keeps the database always-on and the API auto-deploying from GitHub.

**Split hosting is first-class.** Rank mixed options (database on one platform, API on another) as seriously as single-vendor stacks. Always include combinations that reuse the **already-purchased tárhely.eu Start** package.

The outcome of **this** run is a comparison document with a ranked recommendation — not a deploy.

---

## Project facts (this repository)

Read the repo before ranking. Do not invent a different stack.

| Fact | Source / detail |
| --- | --- |
| App | Strapi **5.27** Node API (`package.json` name `backend-strapi`, description “Curr Strapi API”) |
| Runtime | Node `>=20.0.0 <=22.x.x`, npm `>=10` |
| Start | `npm start` → `strapi start`; build `npm run build` → `strapi build` |
| Admin UI | React admin panel is part of the build. The production build is **memory-heavy**. |
| Health | `/_health` |
| Admin / API | `/admin`, `/api` |
| Database today | **Postgres** locally (`docker-compose.yaml`, Postgres 16) and on Render |
| Config | [`config/database.ts`](../config/database.ts): if `DATABASE_URL` is set, client is **always Postgres**. Separate `mysql` / `postgres` / `sqlite` blocks exist when `DATABASE_CLIENT` is used. |
| Drivers | Direct deps: `pg`, `better-sqlite3`. **`mysql2` is not a direct dependency.** Switching to MySQL requires adding it and not relying on `DATABASE_URL` as currently written. |
| Uploads | `@strapi/provider-upload-cloudinary` — keep Cloudinary unless a clearly better free option exists |
| Secrets | `scripts/generate-secrets.js`; env pattern in [`RENDER_DEPLOY.md`](../RENDER_DEPLOY.md) (`APP_KEYS`, JWT salts, `ENCRYPTION_KEY`, `PUBLIC_URL`, `IS_PROXIED`, `CORS_ORIGINS`) |
| GitHub | Deploy must be triggerable by **push to a configured special branch** (native platform Git integration **or** GitHub Actions) |
| Frontend | Appsmith exists in the repo. **Out of scope** except as a CORS client of the API. Do not size the comparison around hosting Appsmith. |

### Known failed path (baseline, not the answer)

Render Free (**512 MB**) **cannot finish `strapi build`**. Heap around 1.5 GB (`NODE_OPTIONS=--max-old-space-size=1536`) plus a **~2 GB** instance was required. Existing service: `curr-zep-strapi` (`https://curr-zep-strapi.onrender.com`). Documented in [`RENDER_QUICK_START.md`](../RENDER_QUICK_START.md) and [`RENDER_DEPLOY.md`](../RENDER_DEPLOY.md). Include this as a **constraint and a baseline option** (paid Render vs keep hostname vs abandon). Do not recommend Free Render for the build step without a workaround (for example CI builds the app and the runtime image only starts).

---

## Constraints and budget

1. **Usage:** roughly **one or two full CRUD workflows per day** (adding financial transactions in Strapi). Almost idle otherwise. Cold starts are **acceptable** if they come with a free or cheap tier.
2. **Database must be permanent.** Sleeping the API is OK. Destroying or wiping the DB on sleep, ephemeral disk, or redeploy is not. SQLite on an ephemeral filesystem is invalid for production.
3. **API must be updatable / redeployable from GitHub** whenever we push a configured special branch.
4. **Budget:** prefer **€0 / $0** for year 1. **A few euros per month is acceptable** if it is what keeps (a) the database always-on and durable and (b) the API auto-deploying. Credit-card registration is OK if nothing unexpected is billed at this usage. Call out year-2 price **explicitly** (trials that cliff after 12 months).
5. **Startup with no funds.** Penalize surprise bills, idle-time charges, and “free then $25/month” cliffs. Prefer always-free or already-paid capacity.
6. **Prefer EU / Hungary** for data (community org, GDPR). Do **not** disqualify a US-only free tier if it is the only workable €0 option; mark the residency trade-off.
7. **Separate modules** when it improves cost, durability, or deploy story. Do not force a single vendor.

---

## Existing hosting (tárhely.eu Start) — treat as an asset

The team **already pays** for [tárhely.eu Start](https://tarhely.eu/normal-tarhely-csomagok-reszletes-osszehasonlitasa/) (cPanel, Budapest DC, GDPR). Mix this into **every** architecture family below. Public specs as of research time (verify; do not assume they make Strapi viable):

| Spec | Public claim | Why it matters |
| --- | --- | --- |
| Disk | **500 MB** NVMe | Strapi `node_modules` + admin build often **will not fit**. Verify with a dry `npm ci` size. |
| Databases | **2** MySQL **or** PostgreSQL | Enough for one production DB. |
| MySQL | 8.0 or 8.4 (or equivalent MariaDB) | Plausible for Strapi 5 **if** we add `mysql2` and stop forcing Postgres on `DATABASE_URL`. |
| PostgreSQL | advertised **9.2.24** | Almost certainly **too old for Strapi 5** (needs a modern Postgres). Treat tárhely Postgres as unfit unless you verify a much newer version on the actual account. |
| Node | cPanel **Setup Node.js App** + Passenger | Long-running Node is possible in principle. **No public custom port** (not `:3000`). Set listen port to `0` if the app requires a port. Verify **Node 20 or 22** is actually offered. |
| PHP | 7.4 / 8.0–8.4 | **Cannot run this API.** PHP is irrelevant except as proof the host is classic shared hosting. |
| RAM | ~2–2.5 GB physical, ~4 GB virtual | Might run Strapi **if disk and Node version allow**. Still may fail the **build** the same way Render Free did. |
| Backups | Daily / weekly / monthly (JetBackup), Budapest | Strong argument for putting the **durable DB** here if remote access works. |
| Traffic | ~0.5 TB/month, ~20 entry processes | Far above 1–2 CRUD calls/day. |

**Unknowns the comparison must resolve (or list as blockers):**

- Can MySQL (or Postgres) be reached **from the public internet** or from an allowlisted remote API host? If not, the API **must** run on the same tárhely account.
- Does cPanel **Git Version Control** (or SSH + GitHub Actions) support **push-to-branch auto-deploy**?
- What Node versions appear in Setup Node.js App?
- Disk used after `npm ci` and after `npm run build`.
- Does Passenger survive `strapi start` (long-lived process, admin, `_health`)?

---

## Architectures to evaluate (all required)

Evaluate **each** family. Give at least one concrete provider pair (or “unfit, because…”) per family.

1. **Single vendor, both API and DB** on one PaaS (Render, Railway, Fly, Koyeb, Oracle, etc.).
2. **DB on tárhely.eu, API elsewhere** (preferred mixed pattern if remote MySQL works).
3. **API on tárhely.eu (Passenger), DB elsewhere** (Neon, Supabase, cheap Postgres, etc.).
4. **API on tárhely.eu, DB on tárhely.eu** (all-in on the paid host).
5. **Split across two free/cheap clouds** (e.g. Neon/Supabase DB + Fly/Koyeb/Cloud Run API), **not** using tárhely for compute or DB — still compare, because tárhely disk may be too small.
6. **CI builds, runtime only:** GitHub Actions (or equivalent) runs `npm ci && npm run build` on a large runner; the host only runs `npm start`. Use this wherever RAM/disk cannot build Strapi (Render Free lesson).
7. **Serverless / scale-to-zero API + always-on managed DB.** Only if you can **prove** Strapi 5 works (cold start, admin, migrations, websocket-less HTTP). Otherwise put it in “do not use” with reasons.
8. **Reuse existing Render service `curr-zep-strapi`** plus either Render Postgres or an external DB. Cost of upgrading RAM vs abandoning the hostname.

For mixed options, score **network path**: SSL to DB, connection pool vs serverless DB, IPv6-only hosts, regional latency (Budapest vs Frankfurt vs US).

---

## Providers and products to include

Cover at least the following. Add others you find that fit a free or few-€/month Strapi + permanent DB story. If a name is dead or unfit, say so in “do not use”.

**API / compute**

- Render (existing `curr-zep-strapi`; Free vs paid RAM)
- Railway
- Fly.io
- Koyeb
- Northflank
- Coolify Cloud (or self-host Coolify — only if there is a **free/cheap** place to put it; do not assume a spare VPS)
- Oracle Cloud Always Free (Ampere VM / ARM)
- Google Cloud Run + Cloud SQL / AlloyDB Omni-class or Neon
- AWS: App Runner, Lightsail, Elastic Beanstalk, ECS Fargate — plus 12-month free tier vs always-free
- Azure Container Apps
- DigitalOcean App Platform
- Hugging Face Spaces
- Cyclic-class / PaaS clones still offering a free Node web service
- Deno Deploy, Vercel, Netlify, Cloudflare Workers — likely **unfit** for stock Strapi; **prove or reject**
- tárhely.eu Setup Node.js App (Passenger)

**Database**

- tárhely.eu MySQL 8 (and tárhely Postgres only if version is verified new enough)
- Neon
- Supabase
- PlanetScale or other serverless MySQL
- Turso / libSQL (likely unfit for Strapi — confirm)
- Aiven free / other forever-free Postgres
- Render Postgres, Railway Postgres
- Oracle Always Free Autonomous DB / Postgres if offered
- ElephantSQL-class hosts (note shutdowns)
- SQLite **only** on a persistent volume that survives redeploy and is backed up — say if anyone actually offers that cheaply

**Git / CI**

- Native GitHub deploy on the PaaS
- GitHub Actions → SSH/rsync/Passenger restart on tárhely
- GitHub Actions → container registry → Fly/Cloud Run/Koyeb
- Build-on-CI to dodge small-RAM hosts

---

## Hard filters (apply before ranking)

Reject or dump into “do not use” unless you have a cited workaround:

1. Strapi 5 is a **long-running Node process**, not PHP, not a single serverless function, unless you cite a working 2025–2026 deployment pattern for Strapi 5.
2. **Node 20 or 22** on the runtime (and on the build machine).
3. **Permanent DB** (managed or persistent disk). No SQLite on ephemeral container FS.
4. RAM/disk enough for **`strapi build`**, **or** a CI/build-elsewhere pipeline so the host only starts a prebuilt app.
5. **GitHub branch-push deploy** (native or Actions). Manual FTP-only is a last resort and must be labelled as such.
6. Year-1 cost: **€0 preferred; a few €/month OK.** Exclude “starts at $25/month” unless nothing cheaper can run the admin build.
7. PHP-only hosts without Node/Passenger cannot run the API (tárhely **does** claim Node — verify versions).

---

## Scoring columns (required for every viable combo)

Fill a comparison table (or equivalent structured list) with:

| Column | What to put |
| --- | --- |
| Combo name | e.g. `tárhely MySQL + Koyeb API (CI build)` |
| Architecture family | 1–8 above |
| Year-1 cost | €/$ and what is already paid (tárhely) |
| Year-2 cost | After trials / credits expire |
| DB persistence | Always-on? Backups? Sleep/pause? Data loss risk? |
| API availability | Always-on vs cold start; typical wake time |
| GitHub deploy | How a special-branch push becomes a live API |
| Build/RAM/disk | Fits Strapi build? Need CI? Cite Render 512 MB failure |
| Data location | Hungary / EU / US |
| Ops pain | Remote MySQL allowlist, SSL, `PUBLIC_URL`, `IS_PROXIED`, Passenger, ARM vs `better-sqlite3` native builds, IPv6 |
| Lock-in / next year | Ease of moving if the project gets a grant |
| Verdict | Viable / viable with caveats / reject |

---

## Research rules

1. **Do not rely on training-memory for prices or free-tier limits.** Look up **current (2026)** docs, status pages, and pricing. Cite **URLs** and a **last-checked date** for every number that affects the ranking.
2. Prefer primary docs over blogs. If a blog is used, corroborate.
3. Confirm Strapi 5 + Node 20 compatibility, not Strapi 4 anecdotes.
4. Confirm whether “free Postgres” **pauses** and whether pause **drops data** or only connections.
5. For Oracle / AWS / GCP “free”, list the **gotchas** (always-free vs 12-month, ARM images, needing a credit card, account suspension, Budapest vs Frankfurt vs Ashburn).
6. If two providers can be paired, **score the pair**, not only each product in isolation.
7. If tárhely disk or Postgres version kills an option, **say that explicitly** rather than leaving it as a maybe.
8. Recommend **MySQL vs Postgres** for this repo: stay on Postgres (current path) vs switch to MySQL to reuse tárhely (code change in `config/database.ts` + add `mysql2`). Do not treat that switch as free of work.

---

## Required output

Write the comparison as markdown (a new file under `docs/` is fine if the user asked you to save it; otherwise the chat response is enough unless they specify a path). Include:

1. **Executive recommendation** (½–1 page): the one combo to try first, why, year-1 cost, and the main risk.
2. **Top 3 mixed-hosting combos** (DB host ≠ API host), ranked, with trade-offs.
3. **Top 3 single-vendor combos**, ranked, with trade-offs.
4. **Full comparison table** for all viable combos (scoring columns above).
5. **Do not use** list: provider or combo, one-line reason (PHP-only, ephemeral SQLite, 512 MB build OOM, dead product, serverless Strapi unproven, tárhely Postgres 9.2, 500 MB disk, etc.).
6. **tárhely.eu verification checklist** the human can run in cPanel before committing:
   - Node versions in Setup Node.js App
   - Disk free vs `npm ci` size
   - Remote MySQL host/port and allowlist
   - Actual Postgres version (`SELECT version();`)
   - Git Version Control / SSH deploy
   - Passenger start of `strapi start` and `/_health`
7. **Code/config implications** if the winner needs MySQL, CI-built artifacts, or `DATABASE_URL` changes — point at [`config/database.ts`](../config/database.ts), [`render.yaml`](../render.yaml), and GitHub Actions. Do **not** implement unless asked.
8. **Next physical step** (one paragraph): the first experiment that is cheap to reverse (e.g. “create Neon DB, point a Fly machine at it, keep tárhely as backup”).

Be concrete. Name plans and euro amounts. Prefer the option that keeps **financial transaction data** safe over the option that is slightly cheaper but can wipe the DB.
