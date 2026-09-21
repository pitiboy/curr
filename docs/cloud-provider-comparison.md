# CURR Strapi 5 hosting comparison (year 1)

**Status:** research only — no deploy.  
**Last checked:** 2026-09-21 (rev 3: scored tárhely **Passenger + Neon/Supabase**; Start still disk-unfit, **Business 5 GB** enters the final 5). Prices and free-tier limits are from primary docs on that date; they change.  
**Repo facts used:** Strapi **5.27**, Node **20–22**, `npm start` / `npm run build`, Postgres locally (`postgres:16`) and on Render, Cloudinary uploads, existing service `curr-zep-strapi` (`https://curr-zep-strapi.onrender.com`).

Local dry measurement on this checkout (2026-09-21): **`node_modules` = 1.1 GB**. tárhely.eu **Start** advertises **500 MB** disk — that kills **Start** as the API host (Neon/Supabase do not shrink the install). **Business** is **5 000 MB**, so the Passenger + remote Postgres path is scored separately.

---

## 1. Executive recommendation

**Try first: Neon Free Postgres in AWS Frankfurt (`aws-eu-central-1`) + Fly.io Machine in `fra`, image built in GitHub Actions, `auto_stop_machines = "stop"`, `min_machines_running = 0`, RAM 1 GB.**

| | |
| --- | --- |
| Architecture | Family 5 (two cheap clouds) + family 6 (CI builds, runtime only) |
| Year-1 incremental cost | **$0 database** + **about $0–8/month** compute. Idle Machines are not billed for CPU/RAM. Always-on 1 GB shared CPU is **$7.78/month** at the published Ashburn rate (Frankfurt can differ slightly). tárhely Start is already paid and is **not** in this path. |
| Year-2 cost | **Same.** Neon Free is not a 12-month trial. Fly has no free allowance for new orgs (legacy hobby allowances ended 2024-10-07). |
| Why this combo | Keeps the **current Postgres path** (`DATABASE_URL` + `pg`). Neon **scale-to-zero does not delete data**. GitHub Actions `ubuntu-latest` has **8 GB RAM (private repo) / 16 GB (public)** — enough for `strapi build`, which Render **Free 512 MB cannot finish**. Fly native Git or Actions → registry gives push-to-branch deploys. Frankfurt + Frankfurt is the closest EU pairing without paying Cloud SQL. Cold starts are acceptable at 1–2 CRUD calls/day. |
| Main risk | **Cold start stack:** Fly Machine boot + Strapi Node boot + Neon compute wake. First admin hit after idle can take tens of seconds, not one. Second risk: **1 GB runtime is tight** (the known failure was the **build**, not proven for serving). If RSS blows 1 GB, bump to 1.5–2 GB (`shared-cpu-6x` ~$11.67 or `shared-cpu-8x` ~$15.56 always-on; still cheaper than Render Standard $25). Third: Fly requires a **card** after a 2-hour / 7-day trial. |

**Close alternatives that belong on the shortlist (omitted in rev 1):**

| If you want… | Use | Why it is not #1 |
| --- | --- | --- |
| One EU PaaS, GitHub, a few euros, always-on | **FridayBuilds** 0.25 CPU / 512 MB web **€2/mo** (1 CPU / 1 GB **€4.50/mo**) + tiny Postgres **€0** | Still **beta** (leaving Q4 2026). **Database backups not implemented.** 128 MB free DB disk is tight. Build RAM is not published (same 512 MB class as Render Free is a risk). DIY `pg_dump` to tárhely required. |
| Enough RAM to **build on the host** + GitHub | **Hostinger Web Apps** (Business: **2 vCPU / 3 GB / 50 GB**, Node **20/22**, GitHub auto-deploy) + **Neon** | Promo **$3.99/mo** is a **48-month prepaid** ($191). **Renews at $16.99/mo**. Web/Cloud plans have **MySQL, not Postgres** — stay on Neon or take a VPS. Pick **Germany / Netherlands / Lithuania**. |
| Always-on EU VM, 4 GB, few euros | **Hetzner CX23** (Falkenstein): **€5.49/mo** excl. IPv4, 2 vCPU / 4 GB / 40 GB | You run Docker, OS patches, and Postgres backups. CX Intel line rose ~38% on 2026-06-15; still cheap vs Render Standard. |
| API on tárhely Node (Passenger) + modern Postgres | **tárhely Business** (5 GB, ~3 GB RAM) + **Neon FRA** | Start’s 500 MB cannot hold this app. Upgrade is ~**€15–20/year** extra. **Do not** `strapi build` on the shared host. **Supabase Free** is the same pairing, worse pause/backups. |
| Hostinger as a VPS instead of Web Apps | **Hostinger KVM 1**: 4 GB / 50 GB NVMe, promo **$6.49/mo**, **renews $11.99/mo**; Germany/France/LT/UK | Same prepaid/renewal cliff as other Hostinger SKUs. Postgres only on VPS, not on Web/Cloud. |

**Why tárhely Node + Neon/Supabase was missing before:** family 3 (API on tárhely, DB elsewhere) was rejected as a *block*, not because remote Postgres is a bad idea. The blocker is **Start’s 500 MB disk**. This checkout’s `node_modules` is **1.1 GB** (`@strapi` alone **413 MB**; ~72k files). Almost all of that is **production** deps (`omit=dev` barely helps). Strapi still needs that tree at `npm start`, even if GitHub Actions builds the admin. tárhely’s own KB says: do not `npm run build` on shared hosting; upload a prebuilt app and only start it. That does **not** shrink `node_modules` under 500 MB.

**Business changes the math:** **5 000 MB** disk, ~**3 GB** physical / **5–6 GB** virtual RAM (table vs prose disagree slightly), 200k files (we are at ~72k). Incremental cost vs Start is about **6 350 Ft/year** first year (Business bruttó **18 923 Ft** vs Start bruttó **12 573 Ft**) — a few euros, not a new PaaS bill. Pair Passenger with **Neon Frankfurt**, not tárhely Postgres 9.2. **Supabase Free** is the same architecture with a worse pause/backup story. That combo is now in the **final 5**.

Keep **Start** for email/JetBackup until/unless you upgrade. Do **not** put financial-transaction data on Render Free Postgres (expires **30 days**, then deletion after a 14-day grace period). Do **not** treat FridayBuilds’ €0 Postgres as the **only** copy of the ledger until they ship backups. Do **not** pay Render **Standard $25 + Postgres $6 ≈ $31/month** unless every cheap path fails — that is the documented working RAM, not the budget winner.

### Final 5 candidates

| # | Combo | Why it is here |
| --- | --- | --- |
| 1 | **Neon FRA + Fly `fra` (CI image, autostop)** | Best durability/cost without upgrading tárhely. First experiment. |
| 2 | **tárhely Business Passenger + Neon FRA (CI build)** | Uses the Node path you already pay toward; **5 GB** fits `node_modules`; Budapest API + modern Postgres. Upgrade Start → Business. Do **not** build on the shared host. |
| 3 | **FridayBuilds 1 GB web + PG ≥1 GB (dump to tárhely)** | Cheapest always-on EU PaaS. Beta; no vendor DB backups. |
| 4 | **Hetzner CX23 Falkenstein + Compose PG16** | 4 GB VM, ~€6–7/mo, you patch. |
| 5 | **Hostinger Web Apps 3 GB (monthly) + Neon** | GitHub + enough RAM that an on-host build might work. **Do not** prepay 48 months. |

**Same family as #2, not a separate fifth slot:** tárhely Business + **Supabase Free** (Frankfurt). Prefer Neon: Supabase Free **pauses after ~7 days** of low activity and has **no automatic backups**. Aiven free PG is a third remote-Postgres variant (may power off if idle). **Business Passenger + local MySQL 8** (no Neon) is family 4: disk fits, JetBackup covers the DB, but needs `mysql2`. Other HU/cPanel Node hosts (same Passenger story) need the **same disk ≥ ~2 GB** check; Hostinger Web Apps is the non-Hungarian analogue already in #5.

**MySQL vs Postgres for this repo:** **stay on Postgres** unless cPanel Remote MySQL from a stable API egress IP is verified **or** you deliberately pick Hostinger Web Apps’ bundled MySQL. Switching is real work: add `mysql2`, stop using `DATABASE_URL` (it **always** selects `postgres` in `config/database.ts`), set `DATABASE_CLIENT=mysql`. tárhely Postgres **9.2.24** is below Strapi 5’s **minimum PostgreSQL 14**. Hostinger Web/Cloud **cannot** run PostgreSQL; Hostinger VPS can.

---

## 2. Top mixed-hosting combos (DB host ≠ API host)

### 1 — Neon Frankfurt + Fly `fra` (CI-built image) — **try this**

- **Trade-off:** best durability/cost for stock Strapi. Pays a few dollars only while the API is awake (or ~$8/month always-on 1 GB). Cold starts. Fly ops (Dockerfile, `fly.toml`, card).
- **Network:** SSL to Neon; use the **pooled** Neon URL if you hit connection limits, and drop `DATABASE_POOL_MIN` toward `0–1` because Neon compute sleeps after **5 minutes**. IPv6: Fly is IPv6-native; Neon is fine over public TLS. Latency Frankfurt–Frankfurt is the point.
- **GitHub:** Actions builds image → GHCR → `fly deploy` on a special branch; or Fly GitHub integration if you accept Fly-side builds with a large enough builder.

### 2 — tárhely.eu **Business** Passenger + Neon Frankfurt (CI-built, runtime only)

- **Trade-off:** this is the option that was skipped on Start. **Setup Node.js App + Apache Passenger**, port **0**, `IS_PROXIED=true`, `DATABASE_URL` = Neon pooled URL. Disk **5 GB** holds 1.1 GB `node_modules`. GitHub Actions: `npm ci && npm run build` on the runner, rsync/git to the app root, cPanel **Restart**. tárhely KB: **do not build on the shared host** (same class of failure as Render Free, even though Business lists 3 GB RAM).
- **Cost:** Business first year **14 900 Ft + ÁFA** (bruttó **18 923 Ft**), year 2 **19 900 Ft + ÁFA** (bruttó **25 273 Ft**). Vs already-paid Start, extra is about **€15–20/year**, plus **$0** Neon. Always-on API in **Budapest**; DB in Frankfurt (~20 ms).
- **Risks:** confirm Node **20 or 22** in Setup Node.js App on the live account. Passenger + long-lived Strapi is plausible at 1–2 CRUD/day but unproven here (`/_health` smoke required). 20 entry processes is plenty. JetBackup backs up the **app files**, not Neon — keep Neon as source of truth and/or dump.
- **Supabase variant:** same Passenger setup, `DATABASE_URL` to Supabase (session or pooled). Worse than Neon for this idle pattern (7-day project pause, no Free backups). Use only if you already have a Supabase project.

### 3 — Neon Frankfurt + Hostinger Web Apps (Germany DC)

- **Trade-off:** Hostinger gives **3 GB RAM / 50 GB NVMe / Node 20 or 22 / GitHub auto-deploy**, so this is one of the few cheap hosts that might **finish `strapi build` on the platform** (the Render Free lesson). Stay on Postgres via Neon; do **not** use Hostinger’s bundled MySQL unless you accept the `mysql2` switch. Web/Cloud **PostgreSQL is unsupported**.
- **Cost trap:** advertised **$3.99/mo** is **48 months prepaid**. Month-to-month list is **$18.99**; **renewal $16.99/mo**. For a no-budget year-1, either pay monthly (then it is worse than Fly **and** worse than tárhely Business + Neon) or skip Hostinger. DCs: France, Germany, Lithuania, Netherlands, UK (web/cloud).
- **Use when:** you want always-on EU compute with enough RAM to build, and you can stomach Hostinger billing — and you would rather not upgrade tárhely.

### 4 — tárhely.eu MySQL 8 + Fly or Koyeb API (CI build)

- **Trade-off:** **Budapest + JetBackup** for the ledger if you *switch* this repo to MySQL. Incremental DB **€0** on Start. Remote MySQL must be proven. **Do not pair tárhely MySQL with FridayBuilds** (private DB network).
- **Use when:** you would rather keep the DB on tárhely than pay for Business disk, and you accept the schema/driver change. **Weaker than Business + Neon** if you are willing to upgrade the tárhely plan anyway.

**Adjacent mixed:** tárhely **Start** Passenger + Neon — **unfit** (500 MB). Aiven free PG + Fly or + tárhely Business. Neon + Koyeb Free (Pro $29 trap; 512 MB). Neon + FridayBuilds web.

---

## 3. Top 3 single-vendor combos

### 1 — FridayBuilds (EU PaaS): web process + Postgres service

- **Year-1:** Developer seat **€0**. Published examples: web **0.25 CPU / 512 MB = €2.00/mo**; worker-sized **1.0 CPU / 1 GB = €4.50/mo**; Postgres **0.1 CPU / 128 MB RAM / 128 MB disk = €0**. Extra reserved storage **€0.12/GB-month** after 128 MB. Scale-to-zero processes are **€0** while stopped. **200 GB** bandwidth included; over quota **stops the app**.
- **Year-2:** Same usage formula **until they leave beta (planned Q4 2026)** — prices may change then.
- **GitHub:** native GitHub integration (v3) or push to `git.fridaybuilds.com`. Paketo buildpacks, Node supported. `Procfile` `web: npm start`. Image size cap **2 GB** (this repo’s `node_modules` is 1.1 GB — likely OK, not huge headroom).
- **Trade-off:** cheapest always-on EU PaaS on the list. **Backups for databases are not yet implemented** (docs, high-priority planned). `DATABASE_URL` is **private to the app**, not for an external API. App filesystem is **ephemeral** (Cloudinary already covers uploads). Build RAM is unspecified — if the builder is 512 MB, `strapi build` fails the same way as Render Free; then use a larger bundle for the first deploy or a CI image if they add Docker later.
- **Reasonable config:** 1 GB web (€4.50) + Postgres with **≥1 GB disk** (~€0.12) + **nightly `pg_dump` to tárhely**. Do not leave 128 MB as the only copy of transaction data.

### 2 — Hetzner Cloud CX23 (Falkenstein) + Docker Compose (Strapi + Postgres 16)

- **Year-1 / year-2:** **€5.49/mo** excl. IPv4 (Germany/Finland, from 2026-06-15 list). 2 vCPU / **4 GB** / 40 GB. Add IPv4 (~a euro). Still a few euros. GitHub Actions → SSH / `docker compose pull`.
- **Trade-off:** enough RAM to **build and serve**, German GDPR operator, always-on, no PaaS sleep. You own patching, firewall, and backups (restic/pg_dump to tárhely or Hetzner Storage Box). CX line is often in high demand.

### 3 — Oracle Cloud Always Free Ampere A1 VM (home region Frankfurt if you pick it at signup)

- **Year-1 / year-2:** **$0** Always Free: **2 OCPU + 12 GB RAM** Ampere, **200 GB** block volume. Run Docker Strapi + Postgres 16. GitHub Actions → SSH/`docker compose pull`.
- **Trade-off:** only combo that is **always-on, enough RAM for the admin build, and €0**. Ops-heavy: ARM images, security updates, backups you own, **capacity “out of host”**, identity check + card hold, **home region is permanent**. Autonomous Database is **Oracle SQL, not Postgres**.

**Also-rans (single vendor):** Hostinger **KVM 1** (4 GB, promo $6.49 → **$11.99 renewal**; Docker Postgres). Hostinger **Web Apps + bundled MySQL** (3 GB, GitHub, MySQL switch, renewal **$16.99**). Northflank sandbox ($0, not “production”). Railway Hobby (~$10–20). Render Standard+PG (~$31, known-good RAM).

**Baseline, not a top-3 pick:** Render **Standard 2 GB ($25) + Basic-256mb Postgres ($6) ≈ $31/month**, Frankfurt, reuse `curr-zep-strapi`. This is the **known-working RAM** after the 512 MB OOM. Budget filter excludes it unless cheaper combos fail. Render Free web (**512 MB**, spin-down 15 min, 750 instance-hours) **cannot finish `strapi build`**. Render Free Postgres **expires in 30 days**.

---

## 4. Full comparison table (viable and near-viable)

Scoring columns as required. **Reject** rows are listed in section 5 instead of here.

| Combo name | Family | Year-1 cost | Year-2 cost | DB persistence | API availability | GitHub deploy | Build / RAM / disk | Data location | Ops pain | Lock-in / next year | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Neon Free + Fly `fra` 1 GB autostop (CI image)** | 5+6 | $0 DB + ~$0–8 API (always-on 1 GB **$7.78** at iad list price) | Same | Neon compute sleeps **5 min**; **storage kept**; 0.5 GB cap; 6 h restore window; hitting CU/egress **suspends compute until next month**, does not wipe data | Cold start OK; Strapi wake can be slow | Actions → GHCR → `fly deploy` on special branch | CI: 8–16 GB RAM. Runtime 1 GB (raise if OOM). No ephemeral SQLite | EU (Frankfurt) | Neon pooled URL, SSL, `PUBLIC_URL`/`IS_PROXIED`, Fly card, Dockerfile | Low: `pg` dump to anywhere | **Viable — first try** |
| Neon Free + Koyeb Free FRA (CI image) | 5+6 | $0 if you **downgrade off Pro $29** and stay on the one free 512 MB service | Same | Same Neon story | Sleep after **1 hour**; cold start | Native GitHub **or** registry image | **Do not build on 512 MB.** Runtime 512 MB = same class as Render Free | EU (Frankfurt) | Signup defaults to **Pro**; $29 auth hold; no spend cap | Low | **Viable with caveats** (runtime OOM risk) |
| Neon Free + Cloud Run (min instances 0, CI image) | 5+6+7 | Likely **$0** at 1–2 CRUD/day on request-based billing if you stay in free-tier seconds; **GCP account + card** | Same unless min instances > 0 | Neon as above | Cold start; Cloud Run is a **request-scoped container**, not a classic daemon. Strapi 5 **has been run this way** as a container (community/RAD), not as a single function | Actions → Artifact Registry → `gcloud run deploy` | Build in CI; give the service **≥1–2 GiB** | EU possible (`europe-west3`); free-tier tables are **us-central1** priced | GCP complexity, Cloud SQL temptation ($), no websockets needed | Medium (GCP) | **Viable with caveats** (prove admin + migrations on a hello deploy) |
| Neon Free + Azure Container Apps consumption | 5+6+7 | Free grant **180k vCPU-s + 360k GiB-s + 2M requests**/month; idle min-replicas=0 | Same | Neon | Scale to zero; cold start | Actions → ACR → ACA | Same CI-build rule | EU regions exist | Azure naming/RG sprawl | Medium | **Viable with caveats** (same serverless-container proof as Cloud Run) |
| Aiven free PG + Fly autostop | 5+6 | $0 DB + Fly as above | Same | 1 GB disk, backups, may **power off** if idle; restartable; no pooling; max 20 conns | Fly cold start | Actions + Fly | CI build | Aiven **chooses** cloud/region | Pool min/max, surprise power-off | Low | **Viable with caveats** |
| Aiven free PG + Koyeb Free | 5+6 | $0 | Same | As above | Koyeb 1 h sleep | GitHub native | 512 MB runtime | Uncontrolled DB region + FRA API | Koyeb Pro trap | Low | **Viable with caveats** |
| **tárhely MySQL 8 + Fly/Koyeb (CI)** | 2+6 | tárhely **already paid** + API $0–8 | tárhely renewal **14 900 Ft + ÁFA/year** (bruttó **18 923 Ft** public page) + API | JetBackup daily/weekly/monthly, Budapest, always-on MySQL | Depends on API host | Actions; tárhely Git is optional | API **not** on 500 MB disk | **HU** DB + EU API | `mysql2`, no `DATABASE_URL`, Remote MySQL allowlist / unstable egress IP / possibly no TLS | Low–medium | **Viable with caveats** — **only after** a remote `mysql` ping from the API host |
| tárhely MySQL + Render Starter Docker (keep hostname) | 2+6+8 | tárhely paid + **$7/month** Starter (512 MB, always-on) | Same | tárhely MySQL | Always-on API | Render Git **or** Docker from GHCR | **Must CI-build**; Starter is still 512 MB RAM | HU DB + Render FRA API | Hostname `curr-zep-strapi.onrender.com` kept | Medium (Render) | **Viable with caveats** if MySQL remote works and 512 MB **serves** |
| Oracle Always Free A1: Strapi + Postgres in Docker | 1 | **$0** Always Free (trial $300 / 30 days is optional extra, not required) | **$0** if you stay inside 2 OCPU / 12 GB / 200 GB | Persistent block volume; **you** snapshot; not a managed PG SLA | Always-on | Actions → SSH / compose | **12 GB** can build **and** run | Frankfurt **if** home region = `eu-frankfurt-1` | ARM, security, backups, capacity, account holds, no PaaS | Medium (VM) | **Viable with caveats** — best €0 always-on |
| Northflank sandbox API + addon PG | 1 | $0 sandbox | $0 until you outgrow; then from ~$2.70+ compute | Addon PG 12–18, TLS, backups on paid story; sandbox disclaimer | Always-on (vendor: “no sleeping”) | GitHub | Unknown free RAM | Regions on Northflank cloud (not HU) | Card for identity; not “production” | Medium | **Viable with caveats** (trial only) |
| Railway Hobby web + Railway PG | 1 | ~**$10–20**/mo realistic; $5 only if usage ≤ $5 | Same | Volume persists; not a 30-day bomb | Always-on | Native GitHub | Hobby allows large RAM (you **pay** for it). Free 0.5 GB: reject for build | Railway regions (not HU) | Idle billed; easy to overspend RAM | Low | **Viable with caveats** (over “few €” easily) |
| Render Standard 2 GB + Render PG Basic-256mb (reuse `curr-zep-strapi`) | 1+8 | **~$31/month** ($25 web + $6 PG) + storage | Same | Paid PG persists; Free PG **30-day delete** | Always-on | Native GitHub; **skip `render.yaml`** or you spawn a second app/DB | **2 GB + `NODE_OPTIONS=1536`** is the known-good build | Frankfurt | Lowest surprise if you just pay | Medium (Render + hostname) | **Reject on budget**; keep as **rollback** |
| Render Starter $7 Docker + Neon | 5+6+8 | $7 + $0 Neon | Same | Neon | Always-on 512 MB | Render Docker deploy | CI must build; 512 MB serve risk | FRA + Neon FRA | Keep hostname | Low–medium | **Viable with caveats** |
| DigitalOcean App Platform 1 GB + Neon | 5 | App **$10–12**/mo + $0 Neon (512 MB app **$5** likely too small to build) | Same | Neon | Always-on | Native Git | 1 GB still may fail **build** → CI image | AMS/FRA-ish | Dev DB $7 is **not** production (dies with app) | Low | **Viable with caveats** (worse value than Fly) |
| PlanetScale Postgres single-node + Fly autostop | 5 | PG from **$5/month** + Fly | Same | Paid, PITR on their plans | Fly | Actions | CI | AWS/GCP (not HU) | Extra $5 vs Neon $0 | Low | **Viable** but **strictly worse than Neon** at this traffic |
| Fly Managed Postgres + Fly Machine | 1 | MPG **Basic $38** + storage $0.28/GB + Machine | Same | HA, backups | Fly | fly deploy | Fine RAM if you pay | Fly regions | Over budget | Medium | **Reject on price** |
| Supabase Free PG + Fly | 5 | $0 | $0, or **Pro $25** if you need no pause | 500 MB; **pauses after ~7 days inactivity**; data kept; **no auto backups on Free**; Frankfurt exists | Fly | Actions | CI | EU possible | Pause vs 1–2 CRUD/day is probably OK; restore is manual | Low | **Viable with caveats** (Neon’s pause is compute-only and shorter, clearer for this idle pattern) |
| **FridayBuilds 1 GB web + FridayBuilds Postgres** | 1 | **€2–4.50** web + **€0–1** DB (bump disk above 128 MB) | Same until Q4 2026 beta exit | Service storage **persists**; **no vendor backups yet**; private `DATABASE_URL`; 128 MB free disk is too small — buy 1 GB | Always-on if the process is running; €0 while scaled to 0 | GitHub or `git.fridaybuilds.com` | Builder RAM **unpublished**; 512 MB web = Render-Free class; **2 GB image cap** vs 1.1 GB `node_modules` | **Europe** (vendor: “Servers in Europe”) | Beta, Paketo, `Procfile`, ephemeral app disk, traffic stop at 200 GB | Medium (young PaaS) | **Viable with caveats** — best cheap EU PaaS; **dump to tárhely** |
| FridayBuilds web + Neon | 5 | €2–4.50 + $0 Neon | Same | Neon backups/PITR story | FridayBuilds always-on | GitHub | Same build risk | EU + FRA | Two vendors | Low | **Viable** if FridayBuilds PG feels too small |
| **Hostinger Web Apps Business + Neon** | 5 | Promo **$3.99/mo × 48 months prepaid**, or **$18.99** list; + $0 Neon | **$16.99/mo** renewal | Neon | Always-on; **3 GB RAM** | Native GitHub; Node 18/20/**22**/24 | **3 GB may finish `strapi build` on-host** (unlike Render Free). 50 GB disk fits `node_modules` | Pick **DE / NL / LT** | Prepaid trap; panel DB wizard is Supabase/Mongo, not Neon — set `DATABASE_URL` manually; `.htaccess` proxy; `IS_PROXIED` | Medium (Hostinger billing) | **Viable with caveats** — only if you **do not** prepay 48 months |
| Hostinger Web Apps + Hostinger MySQL | 1 | Same Hostinger web price | **$16.99/mo** | Managed MySQL, daily backups on Web Apps | Always-on 3 GB | GitHub | Postgres **not** on Web/Cloud | EU DC | `mysql2` + no `DATABASE_URL` | Medium | **Viable with caveats** (schema switch) |
| **Hostinger KVM 1** Docker Strapi + Postgres | 1 | Promo **$6.49/mo** (often 24 mo) | **$11.99/mo** | Volume you snapshot; weekly backups included | Always-on **4 GB** | Actions → SSH | 4 GB can build and run; 50 GB disk | FR/DE/LT/UK (no NL VPS) | Root VM ops | Medium | **Viable with caveats** (renewal cliff) |
| **Hetzner CX23** compose Strapi + PG16 | 1 | **€5.49** + IPv4 | Same (no 12-month cliff) | Persistent disk; **you** backup | Always-on **4 GB** | Actions → SSH | 4 GB / 40 GB fits this repo | **DE** (FSN/NBG) or FI | VM ops; CX stock | Low–medium | **Viable** — best cheap EU VM |
| Sevalla S1 web 1 GB + Neon | 5 | App **$10/mo** (H1 0.3 GB **$5** is too small) + $0 Neon | Same | Neon | Always-on; hibernation optional | Git push / Docker | CI if H1; S1 1 GB | 25 DCs | $20 trial credits | Low | **Viable**; worse value than FridayBuilds/Fly |
| Zeabur Dev + Neon | 5 | Seat **$5** + usage (memory billed) | Same | Neon | Always-on | Git | Model RAM carefully | Varies | Hybrid subscription + usage | Medium | **Viable with caveats** |
| Elestio managed Strapi on Hetzner | 1 | From **~$16/mo** | Same | Managed backups | Always-on | Their panel | They operate it | DE/FI | Over “few €” | Low | **Reject on budget** unless ops time is the scarce resource |
| Strapi Cloud Starter | 1 | **$35/project/mo**; sleeps when idle; **no backups** on Starter | Same or Pro **$90** | Vendor DB | Sleep on Starter | Push to deploy | Official, enough RAM | Strapi’s cloud | Over budget; Starter has **no backup frequency** | High lock-in | **Reject on price** |
| **tárhely Business Passenger + Neon FRA (CI)** | 3+6 | Extra ~**€15–20/year** vs Start (Business bruttó **18 923 Ft** y1 / **25 273 Ft** y2) + **$0** Neon | Business renewal | Neon (sleep ≠ delete). JetBackup is **files**, not Neon | Always-on Passenger | Actions build → git/rsync → Restart | **5 GB** fits 1.1 GB `node_modules`; **do not** `strapi build` on the host; Node 20/22 must exist | **HU** API + FRA DB | Port **0**, `IS_PROXIED`, Passenger, env in cPanel | Low (standard `pg`) | **Viable — final 5 #2** if you upgrade off Start |
| tárhely Business Passenger + Supabase Free FRA | 3+6 | Same tárhely extra + $0 | Same, or Supabase Pro **$25** to disable pause | 500 MB; **pause ~7 days**; **no auto backups** on Free | Always-on API | Same | Same disk/RAM story | HU API + EU DB | Same + pause emails | Low | **Viable with caveats** — same as #2 but strictly worse than Neon |
| tárhely **Start** Passenger + Neon/Supabase | 3 | Already paid + $0 | Start renewal | Neon/Supabase fine | Would be always-on | Actions | **500 MB vs 1.1 GB** — install will not fit | HU + FRA | Disk full before boot | n/a | **Reject on disk** (not on Postgres) |
| tárhely Business + Aiven free PG | 3+6 | Business extra + $0 | Same | Aiven may power off idle free PG | Passenger | Actions | 5 GB OK | HU + uncontrolled Aiven region | Power-off risk | Low | **Viable with caveats** |

**tárhely Start (already paid, public 2026-09-21):** 500 MB NVMe, 2× MySQL **or** PostgreSQL, MySQL 8.0 (table; marketing pages also mention 8.4 / MariaDB), PostgreSQL **9.2.24**, ~2 GB physical / 4 GB virtual RAM, 20 EP, 0.5 TB traffic, 200k files, JetBackup, Budapest, Node via **Setup Node.js App + Passenger**, no public `:3000`. Year-1 promo **9 900 Ft + ÁFA** (bruttó **12 573 Ft**); year-2 **14 900 Ft + ÁFA** (bruttó **18 923 Ft**).

**tárhely Business (needed for Passenger + this repo):** **5 000 MB**, ~3 GB physical / **5–6 GB** virtual (table lists **6 GB** and **3.5 GHz**; marketing prose lists **5 GB** and **3 GHz**), 10 DBs, same Passenger story. First year **14 900 Ft + ÁFA** (bruttó **18 923 Ft**); year 2 **19 900 Ft + ÁFA** (bruttó **25 273–25 275 Ft**). 200k file cap is fine (~72k files in `node_modules` here). **Business Plus (10 GB)** is unnecessary for this install.

---

## 5. Do not use

| Provider / combo | One-line reason |
| --- | --- |
| Render Free web **as the build machine** | 512 MB; this repo already OOM’d `strapi build` even with `NODE_OPTIONS=1536` |
| Render Free Postgres | **30-day expiry**, then data deleted after grace — invalid for a permanent ledger |
| tárhely.eu **PostgreSQL 9.2.24** | Strapi 5 needs **PostgreSQL ≥ 14** (recommended 17) |
| **API on tárhely Start** + any DB (Neon, Supabase, Aiven, local MySQL) | Public **500 MB** vs **1.1 GB `node_modules`**. Remote Postgres does not fix disk. CI build does not remove runtime deps. |
| **API+DB all-in on tárhely using tárhely Postgres** (Start or Business) | Postgres **9.2.24** < Strapi 5 minimum **14** — disk on Business does not fix the engine |
| **API+DB all-in on tárhely Start using MySQL** | Disk still **500 MB** vs 1.1 GB |
| tárhely PHP | Cannot run this API |
| Koyeb **free Postgres** | **5 hours** active time — not a permanent DB |
| Fly.io **Managed Postgres** | Starts at **$38/month** |
| Railway **Free** (0.5 GB) | Same RAM class as Render Free; $1 credit |
| DigitalOcean App Platform **Free** | Static sites only |
| DigitalOcean **development database** | 512 MB, **destroyed with the app**, no real backups |
| AWS **App Runner** | **Closed to new customers** (2026) |
| AWS Lightsail / general AWS “free” | New Free plan is **credits up to ~$200 then account close at 6 months** unless you convert to paid — year-2 cliff |
| Oracle **Autonomous** (ATP/JSON/APEX) | Not Postgres; Strapi will not speak Oracle SQL |
| Coolify Cloud | **$5/month control plane** and **you still bring a server** — no spare VPS in this project |
| Self-host Coolify | Same: needs a VM you do not have for free except Oracle (then just run compose, skip Coolify) |
| Hugging Face Docker Spaces | Docker/Gradio Spaces need **PRO** as of 2026; disk **ephemeral**; free hardware **sleeps** |
| Cyclic.sh | **Shut down 2024** |
| ElephantSQL | **EOL 2025-01-27**, data deleted 2025-02-28 |
| Turso / libSQL | Strapi 5 clients are **sqlite / postgres / mysql** only; Turso needs core patches |
| PlanetScale **Vitess/MySQL** | No free plan; FK story is hostile to Strapi relations |
| Deno Deploy, Vercel, Netlify, Cloudflare Workers | Not a long-running Node process; no proven stock Strapi 5 production pattern |
| SQLite on ephemeral disk | Invalid; nobody in the cheap PaaS set offers a well-backed SQLite volume that beats Neon at $0 |
| Cloud SQL / AlloyDB as the default | Permanent bill; overkill for 1–2 CRUD/day |
| Strapi on Netlify Functions / “serverless Strapi” | Experimental, not proven for this admin+migrations workload |
| **FridayBuilds Postgres as the only copy of the ledger** | Vendor **backups not implemented**; 128 MB free disk is too small |
| Hostinger Web/Cloud **PostgreSQL** | Officially **unsupported**; Postgres needs **VPS** |
| Hostinger **48-month prepaid** for this startup | Locks **~$191** now so the $3.99/mo headline is real; year-2 still **$16.99/mo**. A no-budget org should not prepay four years |
| Sevalla **H1** (0.3 GB) | Too small to build or serve Strapi; S1 1 GB is **$10** |
| Strapi Cloud Starter | **$35/project/month**, sleeps when idle, **no backups** on Starter |
| Elestio Strapi | From **~$16/mo** — over the few-euro bar |

---

## 6. tárhely.eu verification checklist (do this in cPanel before committing)

Run these on the **actual account**. Public pages disagree slightly on Start RAM (2 vs 2.5 GB) and Postgres (9.2.24 vs marketing “10/13” on another page).

**Start (500 MB) — expect fail, confirm anyway:**

1. **Disk used / quota** in cPanel. This repo needs **≳1.2 GB** free after `npm ci` (measured **1.1 GB** `node_modules` + app). If quota is 500 MB, **do not** install Strapi there. Neon/Supabase will not help.
2. **Node versions** in **Setup Node.js App**. Need **20 or 22**. Record the list even if you plan to upgrade to Business.

**Business (5 GB) + Neon or Supabase — this is the real Passenger path:**

1. Upgrade (or order) **Business**, wait until quota shows **5000 MB**.
2. Confirm Node **20 or 22**. Production mode in Setup Node.js App.
3. **Do not** run `npm run build` on the server (tárhely KB + Render lesson). GitHub Actions: `npm ci && npm run build`, then rsync the tree (including `node_modules` **or** `npm ci --omit=dev` in the Passenger env — still ~1 GB).
4. Env in cPanel: `NODE_ENV=production`, `HOST=0.0.0.0`, listen port **0**, `IS_PROXIED=true`, `PUBLIC_URL=https://your-domain`, `DATABASE_URL` = Neon **pooled** URL (or Supabase URI), `DATABASE_SSL=true`, `DATABASE_POOL_MIN=0` or `1`, secrets from `scripts/generate-secrets.js`.
5. Startup file: whatever Strapi 5 expects after build (often the server entry from `package.json` `start` → `strapi start`). Restart from the panel.
6. Hit `/_health` then `/admin`. If Passenger kills the process, you need Fly/Hetzner instead.
7. **Skip tárhely Postgres** (`SELECT version();` if curious — 9.2 is unfit).
8. Git: cPanel Git Version Control **or** SSH from Actions. FTP-only is last resort.

**Remote MySQL** (only if you stay on Start and put the API elsewhere): create DB + user, **Távoli MySQL** allowlist, test port 3306 from the API host.

### FridayBuilds checklist (before putting money or data there)

1. Create a throwaway app on **1 GB** (not 512 MB) and deploy this repo with `NODE_VERSION=20` / engines already in `package.json`. If Paketo **OOM**s on `strapi build`, stop and use CI+Fly or Hostinger 3 GB instead.
2. Confirm image size stays **under 2 GB**.
3. Size Postgres to **≥1 GB disk** and **≥256 MB RAM**, not the €0 128 MB demo.
4. Run a manual `pg_dump` to tárhely **before** any real transactions. There is **no platform backup** yet.
5. Confirm the GitHub branch you want auto-deploys.
6. Do not plan mixed-hosting with tárhely MySQL on this platform (private DB network).

### Hostinger checklist

1. **Do not start at 48-month checkout.** Price the **renewal** ($16.99 Web Apps / $11.99 KVM 1).
2. Web Apps: pick **Germany or Netherlands**, Node **22**, framework **Other**, build `npm run build`, start `npm start`, set all `RENDER_DEPLOY.md` env vars **including `DATABASE_URL` to Neon** (the wizard is Supabase/Mongo, not Postgres).
3. Confirm the panel actually has **3 GB** for the Business plan you buy (Cloud Startup is advertised at **4 GB**).
4. Watch the first deploy for heap OOM anyway; 3 GB is plausible, not proven for this repo.
5. VPS path: KVM 1 in **Germany**, Docker Compose, weekly backups + your own dump.

### Hetzner checklist

1. Order **CX23** in **Falkenstein (fsn1)** or Nuremberg; add IPv4.
2. 40 GB disk: this repo + Postgres + images should fit; keep uploads on Cloudinary.
3. Firewall: 80/443/22 only. Postgres bound to localhost.
4. Actions deploy with an SSH key; never rebuild blindly without a dump.

---

## 7. Code / config implications (do not implement in this run)

**Stay on Postgres (recommended winner):** keep `DATABASE_URL` in `config/database.ts` (forces `client: 'postgres'`). Set `DATABASE_SSL=true`, `DATABASE_SSL_REJECT_UNAUTHORIZED=false` unless you mount Neon’s CA. For Neon scale-to-zero, consider `DATABASE_POOL_MIN=0` or `1` and the **pooled** connection string. Keep Cloudinary.

**If winner is tárhely Business Passenger + Neon:** keep `DATABASE_URL`. Build in Actions; only `npm start` (Passenger, port **0**) on the host. JetBackup is the **app tree**, not Neon.

**If winner is tárhely MySQL:** add direct dependency `mysql2`; **do not** set `DATABASE_URL` (it cannot select mysql today); use `DATABASE_CLIENT=mysql` plus `DATABASE_HOST/PORT/NAME/USERNAME/PASSWORD`. Optional later: teach `database.ts` to parse `mysql://` URLs. Schema is a **fresh** Strapi DB (or a proper dump/transform) — not a flip of the Render Postgres. Same `mysql2` path if you keep API+DB on Business with **local** MySQL.

**If winner is Hostinger Web Apps + MySQL:** same `mysql2` change as tárhely. If winner is Hostinger + Neon, keep `DATABASE_URL` and set it in hPanel env (wizard will not do Postgres).

**If winner is FridayBuilds:** add a root `Procfile` with `web: npm start` if detection is wrong; set the same secrets as Render. Do not rely on local disk. Schedule dumps.

**CI-built artifacts (needed anywhere RAM < ~2 GB, and on tárhely even at 3 GB):** extend `.github/workflows/ci.yml` (already runs `npm run build` on Node 20 with sqlite) with a **deploy workflow** on the special branch: Docker build (multi-stage: build with 8 GB runner, runtime `npm start` only), push `ghcr.io/...`, then `flyctl deploy --image` / Koyeb / Render Docker. For **tárhely Business Passenger**: CI `npm ci && npm run build`, then rsync/git + panel Restart — **do not** build on the shared host. Hostinger 3 GB and Hetzner 4 GB may skip CI-build. Do **not** apply `render.yaml` if it would create a **second** web service and database (`curr-strapi` vs existing `curr-zep-strapi`).

**Proxy env (any PaaS):** `HOST=0.0.0.0`, `IS_PROXIED=true`, `PUBLIC_URL=https://...`, `NODE_ENV=production`. Passenger-only: listen port **0**.

**ARM (Oracle / Fly ARM):** production uses `pg`, not `better-sqlite3`. Build the image as `linux/arm64` (or multi-arch) so native addons match.

---

## 8. Next physical step (cheap to reverse)

Create a **Neon project in `aws-eu-central-1`**, copy the pooled URL, and do **not** migrate production data yet. First experiment: GitHub Actions builds a production Docker image and deploys it to a **Fly app in `fra`** with autostop, 1 GB RAM, and env vars from `RENDER_DEPLOY.md`. Hit `/_health` and `/admin` twice (cold and warm). Leave **tárhely** and **`curr-zep-strapi`** untouched.

**Parallel (also cheap to reverse):** a FridayBuilds throwaway app on **1 GB** with a **1 GB** Postgres disk, same secrets, **no real ledger data**. If `strapi build` OOMs, you have learned the same lesson as Render Free without paying Hostinger’s prepaid. If it works, keep dumps on tárhely and you have a €5-class EU always-on backup path.

**If you want the API in Budapest next:** after the Neon project exists, upgrade tárhely to **Business** only once quota shows **5 000 MB**, then deploy a **prebuilt** tree behind Passenger with the Neon URL. Confirm Node **20/22** in Setup Node.js App first (free check on the current Start account). Skip Hostinger until you have confirmed you will **not** prepay 48 months. Skip Hetzner until Fly/FridayBuilds/Passenger fail and you are willing to run a VM.

---

## Reasonable configurations (copy-paste intent)

These are the stacks that actually fit this repo + budget. Env pattern is always: `NODE_VERSION=20` or `22`, `NODE_ENV=production`, `HOST=0.0.0.0`, `IS_PROXIED=true`, `PUBLIC_URL=https://…`, secrets from `scripts/generate-secrets.js`, `DATABASE_SSL=true` for Neon, Cloudinary as-is.

| Name | API | DB | Deploy | Approx month 1 | Notes |
| --- | --- | --- | --- | --- | --- |
| A — first try | Fly `fra` 1 GB autostop | Neon FRA | Actions → GHCR | $0–8 | Cold start; best durability |
| B — cheap EU PaaS | FridayBuilds 1 GB web | FridayBuilds PG ≥1 GB disk **or** Neon | GitHub | €2–5 | Beta; dump to tárhely |
| C — on-host build | Hostinger Web Apps 3 GB (DE), **monthly** | Neon | Native GitHub | $19 list / $4 only if prepaid | Do not prepay 48 mo |
| D — EU VM | Hetzner CX23 | Postgres 16 in Compose | Actions SSH | ~€6–7 | 4 GB can build; you patch |
| E — €0 VM | Oracle A1 12 GB | Postgres in Docker | Actions SSH | $0 | ARM, capacity, ops |
| F — rollback | Render Standard 2 GB | Render PG $6 or Neon | Native Git, reuse `curr-zep-strapi` | ~$25–31 | Known-good RAM |
| G — HU Passenger | tárhely **Business** Passenger (CI, no on-host build) | Neon FRA (prefer) or Supabase Free | Actions → rsync/git → Restart | ~€1–2 extra vs Start + $0 DB | Port **0**, `IS_PROXIED`. Same slot: local **MySQL 8** on Business (`mysql2`) if you want JetBackup of the DB |

OVH Discovery (~€3.50), Scaleway, Contabo, Netcup, and Hostinger KVM sit in the **same family as D** (cheap EU VPS). Hetzner is the default in that family unless you already have an account elsewhere.

---

## Architecture families (coverage)

| # | Family | Result |
| --- | --- | --- |
| 1 | Single vendor API+DB | **FridayBuilds** (cheap EU PaaS). **Hetzner CX23** / Hostinger KVM 1 (VPS). Oracle Always Free. Northflank sandbox. Railway Hobby. Hostinger Web Apps+MySQL. Render paid (over budget). Fly MPG / Strapi Cloud / Elestio (over budget). |
| 2 | DB tárhely, API elsewhere | MySQL 8 + Fly/Koyeb/Render Docker — viable if remote MySQL works. **Weaker than Business + Neon** if you will upgrade tárhely anyway. Not FridayBuilds (private DB net). Postgres on tárhely: **unfit** at 9.2. |
| 3 | API tárhely, DB elsewhere | **Start: unfit** (500 MB / 1.1 GB). **Business + Neon (CI): final 5 #2.** Business + Supabase / Aiven: same family, worse DB pause/backup. Other HU cPanel Node hosts: same **disk ≥ ~2 GB** gate. |
| 4 | API+DB tárhely | **Postgres: unfit** on every plan (9.2). **Start + MySQL: unfit** (disk). **Business Passenger + local MySQL 8:** disk fits; needs `mysql2`; JetBackup covers the DB. Not in the final 5 because staying on Postgres via Neon is less code change. |
| 5 | Two free/cheap clouds, no tárhely compute/DB | **Neon + Fly** ranked first. Neon + Hostinger Web Apps. Neon + FridayBuilds web. Neon + Koyeb Free. Aiven + Fly. |
| 6 | CI builds, runtime only | **Required** on every 512 MB host **and** on tárhely (vendor: do not build on shared hosting). Hostinger 3 GB / Hetzner 4 GB / Oracle 12 GB may build on-host. |
| 7 | Serverless / scale-to-zero API + always-on DB | **Container** scale-to-zero (Cloud Run, Azure CA, Fly autostop, Koyeb 1 h, FridayBuilds scaled to 0) is plausible. **Function** platforms **rejected**. |
| 8 | Reuse `curr-zep-strapi` | Keep the hostname if a Render **Docker + Starter** or paid RAM path wins. **Do not** pay $25 just to keep the URL. **Do not** apply `render.yaml` blindly. |

---

## Provider notes and sources

All URLs last fetched **2026-09-21**.

| Topic | Source |
| --- | --- |
| Render Free web 512 MB, 15 min spin-down, 750 h; Free PG 1 GB / **30-day expiry** | https://render.com/docs/free |
| Render web **Starter $7 / 512 MB**, **Standard $25 / 2 GB**; PG Basic-256mb **$6**; Free PG $0 30-day | https://render.com/pricing |
| Render workspace plans (Hobby $0) as of 2026-04-23 | https://render.com/docs/faq |
| Neon Free $0, 0.5 GB, 100 CU-h, scale-to-zero 5 min, **data kept** | https://neon.com/docs/introduction/plans |
| Neon Frankfurt `aws-eu-central-1` | https://neon.com/docs/introduction/regions |
| Fly trial 2 h or 7 days; no new-customer free allowance | https://fly.io/docs/about/free-trial/ · https://fly.io/docs/about/discontinued-plans/ |
| Fly Machine list prices (iad); autostop does not bill CPU/RAM while stopped | https://fly.io/pricing/ · https://fly.io/docs/launch/autostop-autostart/ |
| Fly MPG Basic **$38** | https://fly.io/docs/mpg/ |
| Koyeb free 512 MB FRA/WAS, 1 h scale-to-zero; free PG **5 h**; Eco from **$1.61**; **card + Pro default** | https://www.koyeb.com/docs/faqs/pricing · https://www.koyeb.com/docs/reference/instances |
| Railway plans $0 / $5 / $20; RAM $10/GB-month | https://railway.com/pricing · https://docs.railway.com/pricing |
| Oracle Always Free A1 2 OCPU / 12 GB; Autonomous 20 GB **Oracle** DB; home region lock; capacity errors | https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm · https://oracle.com/uk/cloud/free/faq/ |
| Cloud Run free tier (us-central1) | https://cloud.google.com/run/pricing |
| Azure CA free grant | https://azure.microsoft.com/en-us/pricing/details/container-apps |
| AWS App Runner closed | https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html |
| AWS Free plan credits / 6-month close | https://aws.amazon.com/free/ |
| DO App Platform $5+; free = static; dev DB $7 | https://www.digitalocean.com/pricing/app-platform · https://docs.digitalocean.com/products/app-platform/details/pricing/ |
| Northflank sandbox 2 services + 1 addon | https://northflank.com/pricing · https://northflank.com/docs/v1/application/billing/pricing-on-northflank |
| Coolify Cloud $5 + bring servers | https://coolify.io/docs/get-started/cloud |
| Hugging Face Docker needs paid plan | https://huggingface.co/docs/hub/spaces-overview |
| Cyclic shutdown | https://www.cyclic.sh/posts/cyclic-is-shutting-down |
| Aiven free PG 1 GB, may power off idle | https://aiven.io/docs/products/postgresql/concepts/pg-free-tier |
| ElephantSQL EOL | https://www.elephantsql.com/eol.html |
| PlanetScale no free plan; PG from $5 | https://planetscale.com/docs/planetscale-plans |
| Strapi 5 DB: MySQL 8 / MariaDB / **PG ≥ 14** / SQLite | https://docs.strapi.io/cms/configurations/database |
| GitHub-hosted runners 8 GB private / 16 GB public | https://docs.github.com/en/actions/reference/runners/github-hosted-runners |
| tárhely Start + **Business** specs/price (5 000 MB, 3 GB RAM, y1 **18 923 Ft** bruttó, y2 **19 900 Ft + ÁFA**) | https://tarhely.eu/normal-tarhely-csomagok-reszletes-osszehasonlitasa/ |
| tárhely Node/Passenger, **don’t build on shared host** | https://ugyfeladmin.tarhely.eu/index.php/knowledgebase/510/Node.js-hasznalata-osztott-cPanel-tarhelyen.html |
| tárhely Remote MySQL | https://ugyfeladmin.tarhely.eu/index.php/knowledgebase/98/Mysql-kapcsolodasi-adatok-tavoli-mysql-kiszolgalo.html |
| Supabase Free pause ~7 days | https://supabase.com/docs/guides/platform/free-project-pausing · https://supabase.com/pricing.md |
| FridayBuilds pricing (512 MB €2, 1 GB €4.50, 128 MB PG €0); EU; GitHub; **no DB backups yet**; 2 GB image; private DATABASE_URL | https://fridaybuilds.com/pricing · https://fridaybuilds.com/docs · https://fridaybuilds.com/changelog/fridaybuilds-v3-is-live |
| Hostinger Web Apps $3.99 promo / $18.99 list / **$16.99 renewal**; 3 GB; GitHub; Node 18–24; managed MySQL | https://www.hostinger.com/nodejs-hosting · https://docs.hostinger.com/node.js/creating-an-app |
| Hostinger Postgres **VPS only**; Web/Cloud = MySQL | https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/ |
| Hostinger KVM promo vs renewal; EU DCs FR/DE/LT/UK | https://www.hostinger.com/vps-hosting · https://www.hostinger.com/support/1583267-where-are-hostinger-servers-located/ |
| Hetzner CX23 **€5.49/mo** excl IPv4 (DE/FI, from 2026-06-15) | https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/ · https://www.hetzner.com/cloud |
| Sevalla from $5 (H1 0.3 GB) / S1 1 GB $10 | https://sevalla.com/pricing/ · https://sevalla.com/pricing/calculator/ |
| Strapi Cloud Starter **$35**/mo, no backups on Starter | https://strapi.io/pricing-cloud |
| Elestio managed Strapi from ~$16 | https://elest.io/open-source/strapi |

### Extra gotchas (Oracle / AWS / GCP “free”)

- **Oracle:** card authorization holds, **home region frozen** at signup (pick Frankfurt if EU data matters), Ampere **capacity**, ARM, Always Free Autonomous is **not** Postgres, exceeding Always Free after trial can **delete extra A1 VMs**.
- **AWS:** App Runner unavailable to new accounts; Lightsail old 90-day trials replaced by **time-boxed credits**; converting to paid is how surprise bills start.
- **GCP:** Cloud Run free tier is real for scale-to-zero; **min instances = 1** or Cloud SQL will not stay at €0. Prefer Neon over Cloud SQL for this budget.

---

## Existing Render baseline (constraint, not the answer)

Documented in `RENDER_QUICK_START.md` / `RENDER_DEPLOY.md`: Free **512 MB cannot finish `strapi build`**; heap ~1.5 GB plus a **~2 GB** instance was required (`NODE_OPTIONS=--max-old-space-size=1536`). Reuse `curr-zep-strapi`; do not apply `render.yaml` if it creates a second database. That path works **if you pay Standard**. This comparison’s job is to avoid that bill for year 1.
