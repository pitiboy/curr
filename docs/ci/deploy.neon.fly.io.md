# Path 1 year-1 finalization prompt (CURR)

## How to use

Paste this whole file into an agent (or `@`-mention it in Cursor) and ask it to **execute** the prompt: reconfigure **this repository** so it is the Path 1 year-1 backend, then stop.

This file is the prompt. The decision is already made. Do **not** re-rank backends or hosts. Do **not** write another comparison.

Locked sources (read first; do not contradict):

- [`docs/backend-strategy-comparison.md`](./backend-strategy-comparison.md) — **Path 1 for twelve months**
- [`docs/cloud-provider-comparison.md`](./cloud-provider-comparison.md) — Path 1 host is **Neon FRA + Fly `fra`**
- [`RENDER_DEPLOY.md`](../RENDER_DEPLOY.md) — env-var pattern to reuse, **not** the year-1 host

---

## Role and goal

You are implementing the **year-1 Path 1 cutover** for CURR (Community Unified Resource Registry / KÖR): a no-budget Hungarian community ledger.

**Take Path 1:** keep this repository’s **Strapi 5.27** app, Postgres on **Neon Frankfurt** (`aws-eu-central-1`), Node on **Fly.io `fra`**, treasurers in **Strapi Admin**, later custom client on **Strapi REST**.

Outcome of **this** run: the checkout is Path-1-ready (config, Docker, Fly, CI deploy, docs, Neon-safe pool). Live Neon/Fly accounts, first seed, Treasurer role, and the first real fee are **operator steps** you document and only execute if credentials already exist. You do **not** ship a custom client.

---

## Decision (already locked — do not reopen)

| Locked | Meaning |
| --- | --- |
| Backend | This repo’s Strapi **5.27**. Stay on that version unless a security patch is required and you say so. |
| Database | Neon Postgres, region **`aws-eu-central-1`**. Pooled `DATABASE_URL`. Sleep keeps **data**. |
| API host | Fly Machine **`fra`**, **1 GB** RAM, `auto_stop_machines = "stop"`, `min_machines_running = 0`. Image built in **GitHub Actions**, not on Fly’s small builder. |
| Year-1 UI | **Strapi Admin** at `/admin`. Hungarian labels already exist. |
| Later client | Strapi **REST** (`/api`). **Out of year-1.** Do not design screens. |
| Usage | About **one or two full CRUD workflows per day**. Cold start is acceptable. |
| Not Path 2 | No PostgREST, no Neon Data API as the app, no Supabase, no DBeaver as treasurer UI, no SQL `post_transaction()`, no dropping Strapi. |
| Not a hosting bake-off | Do not deploy to Render, tárhely, FridayBuilds, Hostinger, or Hetzner in this run. Leave **`curr-zep-strapi`** and tárhely **untouched**. Do **not** apply [`render.yaml`](../render.yaml) (it would create a second web+DB). |

Mid-year “Strapi now, PostgREST later” is invalid. GraphQL is extra work and **off**.

---

## What this run is vs the 90-day sequence

[`docs/backend-strategy-comparison.md`](./backend-strategy-comparison.md) §4 is the operating sequence. Map it like this:

| Window | This run |
| --- | --- |
| **Days 1–14 — first experiment** | **Must do in-repo.** Dockerfile, `fly.toml`, `.dockerignore`, CI image → GHCR → `fly deploy` on a **special branch**, Neon-safe DB pool, env/docs. Operator checklist for Neon + Fly + secrets. If Fly/Neon credentials are already in the environment, you **may** run the first deploy and hit `/_health` and `/admin` twice (cold/warm). If they are not, stop at artifacts + checklist — do not invent accounts. |
| **Days 14–30 — first real transaction** | **Do not** `seed:full` on production unless the user explicitly says the Neon project is empty and approved. **Do** document: `npm run seed:full`, Treasurer Admin role (Content Manager on transaction/receipt/member; read on accounts/types; **no** Content-Type Builder), Public `find`/`create` **off**, one live fee in Admin. Optional: a **bootstrap or documented Admin recipe** for the Treasurer role and default-deny Users & Permissions — no live posting. |
| **Days 30–60 — integrity and uploads** | **In-repo only, allowed if cheap:** mark `debit_account` and `credit_account` **`required: true`** in [`src/api/transaction/content-types/transaction/schema.json`](../src/api/transaction/content-types/transaction/schema.json). Confirm Cloudinary stays in [`config/plugins.ts`](../config/plugins.ts) and env is listed. **Do not** add a SQL posting RPC. **Do not** add a transaction lifecycle unless it is a small JS guard for missing debit/credit **after** the schema change. |
| **Days 60–90 — freeze** | **Document only:** weekly `pg_dump` of Neon, rehearse cold-start Admin, refuse custom client / member self-serve / CSV import / scheduled fees / project-balance API / org-scoped Admin. |

If time is short, finish **Days 1–14 in-repo** and the operator checklist. Do not start Path 2 work to “get ahead.”

---

## Repo facts (inspect before editing)

| Fact | Detail |
| --- | --- |
| App | Strapi **5.27** at **repository root** (`package.json` name `backend-strapi`) |
| Runtime | Node `>=20.0.0 <=22.x.x`, npm `>=10`. CI already uses **Node 20**. |
| Start / build | `npm start` → `strapi start`; `npm run build` → `strapi build`. Admin build is memory-heavy — **never** `strapi build` on a 512 MB host. |
| Health / Admin / API | `/_health`, `/admin`, `/api` |
| HTTP API | **REST only.** `@strapi/plugin-graphql` is **not** in `package.json`. Leave it that way. |
| Auth | `@strapi/plugin-users-permissions`. Admin users ≠ end-users. Super Admin = full DB. |
| Uploads | `@strapi/provider-upload-cloudinary` already in [`config/plugins.ts`](../config/plugins.ts) |
| DB config | [`config/database.ts`](../config/database.ts): `DATABASE_URL` **forces postgres**. Default pool **min 2 / max 10** — too hot for Neon scale-to-zero. Change default **min toward 0–1** when URL is set (env `DATABASE_POOL_MIN`). SSL via `DATABASE_SSL` (production default true). |
| Server | [`config/server.ts`](../config/server.ts): `PUBLIC_URL`, `IS_PROXIED` (true in production), `HOST=0.0.0.0`, `PORT` (Fly sets `PORT`) |
| CORS | [`config/middlewares.ts`](../config/middlewares.ts) still lists `RENDER_EXTERNAL_URL`. Keep it as a leftover; **do not** make Render the documented production URL. |
| Local DX | [`docker-compose.yaml`](../docker-compose.yaml) Postgres **16**. Keep for `npm run develop`. Production is Neon, not Compose. |
| Seeds | `npm run seed:full` → [`scripts/seed-database.js`](../scripts/seed-database.js). Keep. Path 2 SQL rewrite is **out**. |
| Lifecycle | [`src/api/member/content-types/member/lifecycles.ts`](../src/api/member/content-types/member/lifecycles.ts) — **keep.** Member → account on first org. |
| Transaction schema | `date` and `amount` required; **`debit_account` / `credit_account` are not.** `draftAndPublish: true` on `transaction` and `receipt` only. |
| CI today | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — `npm ci`, `strapi build` (sqlite), `typecheck` on `main` + PRs. **No Docker, no Fly, no GHCR.** |
| Missing | **No** `Dockerfile`, **no** `fly.toml`, **no** `.dockerignore`, **no** deploy workflow. |
| Sidecars | `apps/frontend-appsmith/`, `apps/cost-planner/`, leftover `apps/backend-strapi/` — **not** the production app. Do not size Path 1 around Appsmith. Do not delete the leftover tree unless the user asks. |
| Domain write-up | [`docs/readme.md`](./readme.md) — self-serve, schedule, import, reports: **out of year-1**. Data model may still allow them later. |

**Known failed path (constraint):** Render Free **512 MB cannot finish `strapi build`**. That is why CI builds the image. Do not “fix” year-1 by paying Render Standard.

---

## Required in-repo work (Days 1–14)

### 1. Production container

Add a **multi-stage Dockerfile** at repo root:

- Build stage: Node **20**, `npm ci`, `NODE_ENV=production`, secrets **dummy** (same pattern as current CI) so `strapi build` can run. GitHub-hosted runner has 8–16 GB; do **not** assume Fly build RAM.
- Runtime stage: production `npm start` only, `HOST=0.0.0.0`, listen on `PORT`. Include production `node_modules` (Strapi needs them at start). `node_modules` is **~1.1 GB** — image will be large; that is expected.
- Prefer `linux/amd64` unless you deliberately choose Fly ARM and then native `pg` must match. Production uses **`pg`**, not sqlite.
- Add `.dockerignore` (`node_modules`, `.git`, `.tmp`, `apps/`, docs noise as appropriate — do **not** exclude `src/`, `config/`, `favicon`, admin build inputs).

### 2. Fly app config

Add `fly.toml`:

- Region **`fra`**
- HTTP service on the Strapi port / Fly `PORT`
- Hard health check **`/_health`**
- **1 GB** RAM (`1024` MB); shared CPU is fine
- `auto_stop_machines = "stop"`, `min_machines_running = 0`, autostart on request
- No Fly Postgres / Fly MPG (that is **$38**-class and was rejected). Database is Neon.

Do **not** commit Fly API tokens.

### 3. GitHub Actions deploy

Extend CI **without** breaking PR typecheck/build:

- Keep existing `main` / PR job (sqlite `strapi build` + typecheck).
- Add a **deploy workflow** on a **special branch** (name it, e.g. `deploy/fly`, and document it). On push: build Docker image on `ubuntu-latest`, push **`ghcr.io/<owner>/<repo>`**, then `flyctl deploy --image … --remote-only` (or equivalent current Fly docs).
- Need: `FLY_API_TOKEN`, GHCR permissions. Document required GitHub secrets. Do not put secrets in the repo.
- `NODE_OPTIONS=--max-old-space-size=1536` (or similar) on the **build** stage so admin compile does not OOM on the runner either.

Read **current (2026)** Fly + GitHub Container Registry docs; do not invent flags from memory.

### 4. Neon-safe Strapi config

In [`config/database.ts`](../config/database.ts) (and `.env.example`):

- When `DATABASE_URL` is set, default **`DATABASE_POOL_MIN` to `0` or `1`** (not 2). Keep max modest (Neon Free connection limits).
- Document: production `DATABASE_URL` = Neon **pooled** connection string; `DATABASE_SSL=true`; `DATABASE_SSL_REJECT_UNAUTHORIZED=false` unless a CA is mounted.
- Production `NODE_ENV=production`, `HOST=0.0.0.0`, `IS_PROXIED=true`, `PUBLIC_URL=https://<fly-app>.fly.dev` (or custom domain later).
- Secrets still from `node scripts/generate-secrets.js` — same names as [`RENDER_DEPLOY.md`](../RENDER_DEPLOY.md): `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`.
- Cloudinary: `CLOUDINARY_NAME`, `CLOUDINARY_KEY`, `CLOUDINARY_SECRET`, optional preset/folder. Copy from Render **when** going live; do not invent values.

Optional small default: `DATABASE_POOL_MAX` lower than 10 on Neon Free if vendor docs say so — cite the doc.

### 5. Docs in this repo

- Add a **Fly + Neon** deploy doc (e.g. `FLY_DEPLOY.md`) that is the **year-1 production path**: Neon project region, pooled URL, Fly app, secrets, health URLs, cold-start expectation, “hit `/_health` and `/admin` twice.”
- Update [`README.md`](../README.md): production is Fly+Neon, not Render. Point at the new doc. Leave Render docs in place as **rollback / history**, labeled as such.
- Update `.env.example` comments: Neon pooled URL, `DATABASE_POOL_MIN`, `IS_PROXIED`, Fly `PUBLIC_URL`. Local Docker Postgres stays the default for `develop`.
- Do **not** rewrite [`docs/backend-strategy-comparison.md`](./backend-strategy-comparison.md) or the hosting comparison. You may add one line to README linking them as the ADR.

### 6. Operator checklist (required output)

Write a short checklist the human still has to do (accounts/card cannot live only in git):

1. Neon project in **`aws-eu-central-1`**. Copy **pooled** URL. Do **not** migrate Render data on the first experiment.
2. Fly org, **card** (trial is 2 h / 7 days; new orgs have no free allowance), app in **`fra`**, secrets via `fly secrets set`.
3. GitHub: special branch, `FLY_API_TOKEN`, GHCR package permissions.
4. First boot: create **Super Admin** in `/admin`, then a **Treasurer** Admin role (no Content-Type Builder). Do not invite members as Admin.
5. Users & Permissions: Public **`find`/`create` off** on `transaction`, `member`, and every collection type that is a ledger row. Re-check after every deploy (risk **R2**).
6. Cloudinary env on Fly (risk **R12**).
7. After empty Neon is confirmed: `npm run seed:full` against that DB (days 14–30 — not this run unless asked).
8. **Never** point DBeaver at Strapi tables as the treasurer UI (risk **R14**).

---

## Allowed later in the same PR (only if Days 1–14 artifacts are done)

- `debit_account` / `credit_account` **`required: true`** in the transaction `schema.json`.
- Document Treasurer vs Super Admin; optional bootstrap that **closes Public** and does **not** invent a custom client.
- README / `docs/readme.md` note: year-1 refuses member self-serve, CSV import, scheduled fees, project-balance API, org-scoped Admin.

Do **not** implement those refused features “while you are in the files.”

---

## Hard filters

- Do **not** drop Strapi, add Prisma, add GraphQL, or remodel tables as SQL.
- Do **not** enable Neon Data API / PostgREST as the application API.
- Do **not** add `post_transaction()` or Postgres triggers “for later Path 2.”
- Do **not** design the custom client, Appsmith screens, or member self-serve.
- Do **not** use DBeaver / Studio / SQL as the year-1 posting UI in docs or runbooks.
- Do **not** switch to MySQL / sqlite in production. sqlite is CI/local only.
- Do **not** put the ledger on Render Free Postgres (30-day expiry).
- Do **not** apply `render.yaml`. Do not delete `curr-zep-strapi`.
- Do **not** `strapi build` in the Fly runtime image as the only build (build in CI / Docker build stage).
- Do **not** commit `.env`, Neon passwords, `APP_KEYS`, or `FLY_API_TOKEN`.
- Do **not** bump Strapi off 5.27 without an explicit security reason.
- Do **not** raise Fly RAM past 1 GB in the first experiment unless the image **cannot start**; then bump per hosting doc (1.5–2 GB) and say why.
- Do **not** add org-scoped Admin / RLS theatre. Honest year-1: one org after seed; treasurers see the whole ledger.

---

## Implementation rules

1. Read the two comparison docs and the files in the table **before** editing.
2. Prefer boring Fly + Docker + Actions patterns. Cite current Fly/Neon URLs in the deploy doc with a **last-checked date**.
3. Smallest change that makes Path 1 operable. No drive-by refactors, no Nx resurrection, no deleting `apps/backend-strapi/` unless asked.
4. After code edits: `npm run typecheck`. Docker build locally if the environment allows; if not, say so.
5. Do not run `seed:full` or `cleanup:orgs` against a database that might hold real rows.
6. If Fly/Neon cannot be created from this session, **ship the repo artifacts and the checklist** and stop. That is a successful start.

---

## Success criteria

This run is done when:

1. A production **Dockerfile** + **`fly.toml` (`fra`, 1 GB, autostop)** + **deploy workflow** exist and are documented.
2. `DATABASE_URL` pool defaults are Neon-safe; `.env.example` and a Fly/Neon deploy doc match [`RENDER_DEPLOY.md`](../RENDER_DEPLOY.md) secrets plus Cloudinary.
3. README’s production path is Fly + Neon; Render is rollback, not the plan.
4. Operator checklist covers Neon region, pooled URL, Fly secrets, Public deny, Treasurer role, no DBeaver, no seed until empty Neon is confirmed.
5. No Path 2 code, no GraphQL, no custom client, no live ledger rewrite.

Last sentence of your wrap-up: **Path 1 year-1 repo cutover is ready for the Fly + Neon first experiment.**