# Backend strategy comparison prompt (CURR)

## How to use

Paste this whole file into an agent (or `@`-mention it in Cursor) and ask it to **execute** the prompt: research current offerings and write a **CTO decision proposal**.

This file is the prompt. Do not treat it as already-finished research. Do not deploy, migrate, or implement unless a later, separate request asks you to.

Related but **out of scope for this run:** [`cloud-provider-comparison.md`](./cloud-provider-comparison.md) already ranked **how to host Strapi**. Do not re-score Fly, Render, tárhely, or Neon-as-a-database-host.

---

## Role and goal

You are writing an architecture decision record for the CTO of a no-budget Hungarian community startup (CURR — Community Unified Resource Registry / KÖR). The decision is **which backend to run for the next ~12 months**.

Both paths will eventually grow a **first-party custom client**. That client is **later**. You must **not** design screens, information architecture, or Appsmith/Retool builds. You **must** score each path as the **API and data contract that client will sit on**, and you **must** say how treasurers record real ledger rows **before** that client exists.

The outcome of **this** run is a recommendation: **Path 1 or Path 2**. Not a vendor encyclopedia. Not a hosting bake-off. Not a migration project plan.

---

## Decision to answer (locked)

Pick **one** backend for the next **~12 months**. Switching mid-year is **out of bounds**. A phased “start on Strapi, move to PostgREST in month 6” answer is invalid as the recommendation. You may still describe **year-2 exit cost** (cost of being wrong after month 12) so the pick is informed — that is not a license to recommend switching this year.

### Path 1 — Neon + Strapi 5 on Fly.io, custom client later

Keep **this repository’s Strapi 5.27 app**. Postgres is **Neon** (Frankfurt). The Node process runs on **Fly.io** (`fra`), as already recommended in [`cloud-provider-comparison.md`](./cloud-provider-comparison.md). Year-1 operators use **Strapi Admin**. The later custom client talks to **Strapi’s API**.

Do **not** re-rank hosting. Treat Fly + Neon as given for Path 1. Mention cost/ops of that combo only as **application-layer TCO** (you still run a Node process), citing the hosting doc rather than re-researching PaaS tables.

### Path 2 — Managed Postgres with automatic REST and/or GraphQL, custom client later

**Drop the Strapi Node app.** Put the domain in a **fully managed Postgres** that already exposes **REST and/or GraphQL** and **row-level security** (plus vendor auth if they ship it). Year-1 operators must still enter real transactions using **whatever the vendor ships** (dashboard table editor / Studio / SQL) or a **trivial generated CRUD** you may **name** but not spec. The later custom client talks to **that vendor API**. There is **no** long-running Strapi process.

---

## Locked constraints (from the CTO)

1. **Live operations before the custom client.** Treasurers/operators must record **real** ledger transactions **soon**, using a shipped backend UI (Strapi Admin, vendor Studio, SQL, or a named trivial table UI). Waiting for a custom client to go live is **not** allowed.
2. **Custom client is later, on both paths.** Do not design it. Do score the **backend contract** it will call.
3. **One pick for ~12 months.** Do not recommend a mid-year platform switch.
4. **This repo is the yardstick**, not two greenfield stacks. Content-types, lifecycles, Cloudinary, seeds, and Users & Permissions already exist.
5. **Usage:** about **one or two full CRUD workflows per day** (posting financial transactions). Almost idle otherwise.
6. **Org:** no-budget community startup, **CTO-led**, small team. Prefer boring, operable, reversible-in-year-2 over elegant. EU/Hungary data preference is inherited from the hosting comparison; do not disqualify the only workable Path 2 vendor if it is US-only — mark residency.
7. **Year-1 euros are secondary.** Time-to-live-operations and **ledger integrity** outrank a few euros. Still report a honest TCO footnote (Path 1 still pays Fly-class compute; Path 2 often bundles API+DB).
8. **Do not implement.** Point at files. Do not change `config/`, schemas, or deploy.

---

## Project facts (this repository)

Read the repo before ranking. Do not invent a different domain.

| Fact | Source / detail |
| --- | --- |
| App | Strapi **5.27** (`package.json` name `backend-strapi`) at the **repository root** |
| Runtime | Node `>=20.0.0 <=22.x.x`, npm `>=10` |
| Start / build | `npm start` → `strapi start`; `npm run build` → `strapi build` |
| Admin / API | `/admin`, `/api`, `/_health` |
| HTTP API today | **REST only.** `@strapi/plugin-graphql` is **not** in [`package.json`](../package.json). Path 1 GraphQL is extra work, not a given. |
| Auth | `@strapi/plugin-users-permissions` (JWT; Admin vs Authenticated vs Public; per-content-type CRUD) |
| Uploads | `@strapi/provider-upload-cloudinary` — already wired |
| Database today | Postgres locally ([`docker-compose.yaml`](../docker-compose.yaml), Postgres 16) and on Render; [`config/database.ts`](../config/database.ts) forces **postgres** when `DATABASE_URL` is set |
| Hosting already chosen for Path 1 | Neon Free FRA + Fly `fra` (CI-built image, autostop). See [`cloud-provider-comparison.md`](./cloud-provider-comparison.md). Render Free **cannot** finish `strapi build`. |
| Sidecar UIs | `apps/frontend-appsmith/` exists. **Out of scope** except as “an existing API consumer that would be remapped.” Do not size either path around hosting Appsmith. |
| Domain write-up | [`docs/readme.md`](./readme.md) — community resource accounting, **double-entry**, multi-currency (money, time, food, goods) |

### Content-types (source of truth: [`src/api/`](../src/api/))

| Type | Notes the comparison must honour |
| --- | --- |
| `organization` | Collective; has accounts, memberships |
| `member` | Individual; **oneToOne** `account`; UID `identifier`; unique email |
| `membership` / `membership-type` | Member ↔ organization role (tag, bentlakó, szimpatizáns, …) |
| `account` / `account-category` | Chart of accounts; **parent/children** tree; org-scoped |
| `transaction` / `transaction-type` | Double-entry: required `amount`, `debit_account`, `credit_account`; **`draftAndPublish`: true** |
| `receipt` | Linked to transactions; **`draftAndPublish`: true**; media |
| `currency-type` / `currency-category` / `currency-rate` | Multi-currency / resource types |

**Lifecycle already in code:** [`src/api/member/content-types/member/lifecycles.ts`](../src/api/member/content-types/member/lifecycles.ts) — creating a member **creates an account** on the first organization if none is supplied. Path 2 must say how that rule lives (trigger, RPC, edge function) on day 1, not “the custom client will do it later.”

Receipt controller/routes/services are stock core factories — no extra business logic there yet.

---

## Factual corrections (do not repeat folklore)

1. **Strapi 5 is not Prisma.** Denormalized / document-style tables (documents, versions, link tables, components) come from **Strapi’s own document service**, not Prisma. Inspect current Strapi 5 schema docs **and**, if you can, the shape implied by these content-types. Do not blame Prisma in the proposal.
2. **Neon in the hosting doc is storage for Strapi**, not an application backend. Neon belongs on Path 2 **only** if **current (2026)** vendor docs prove a production **Data API** (REST and/or GraphQL) **plus** auth and **RLS (or equivalent)** that can replace Strapi’s application layer. Otherwise list Neon under **do not confuse**: “DB host for Path 1, not a Path 2 backend.”
3. **RBAC is not a ledger. RLS is not a ledger.** Users & Permissions and Postgres RLS do not enforce debit+credit, balanced amounts, or account-tree rules by themselves. Score **how each path implements invariants**, not whether roles exist.
4. **Strapi Admin is a year-1 bridge, not the product UI.** Both paths get a custom client later. Do not treat Admin as a permanent free product win.

---

## What you must research

### 1. Year-1 operating model (mandatory for both paths)

For **each** path, write who clicks what on **day 1** to post a double-entry transaction (date, amount, debit account, credit account, type, currency, optional receipt). Cover:

- Can a non-developer treasurer do it without SQL?
- Draft/publish on `transaction` and `receipt` — possible without the custom client?
- Org-scoped access (membership) — possible, or is everyone a superuser in year 1?
- Residual risk of operators using a **generic Studio** on financial data (wrong row, no debit/credit pairing, unpublished drafts).

Path 2 may **name** a stopgap (Supabase Table Editor, Hasura Console, `psql`, a generated admin such as Directus **only if you have promoted that vendor into Path 2**). Do **not** spec a custom app.

### 2. Bridge vs dual-surface tax

- **Path 1:** Strapi Admin now + custom client later. Two UIs on a **CMS document API**. Permission drift, upgrade churn, client fighting Admin’s payload shape.
- **Path 2:** Vendor Studio now + custom client later. Two UIs on **owned SQL**. Studio is weaker for non-developers; schema is portable.

Score this explicitly. Admin must not look like a free forever product.

### 3. Future client contract

What the custom app would call:

| Topic | Path 1 | Path 2 |
| --- | --- | --- |
| Shape | Strapi REST document API (`data` / `attributes` / populate); GraphQL **not** installed | PostgREST table JSON and/or vendor GraphQL |
| Auth | Strapi JWT / users-permissions | Vendor Auth + RLS (`auth.uid()`), service role danger |
| Filters / pagination | Strapi query params | Querystring / GQL |
| Aggregates (balances, project reports in [`docs/readme.md`](./readme.md)) | Not generated; custom controller or client-side | SQL views / RPCs the client can call |
| `draftAndPublish` | First-class on transactions/receipts | You must model status yourself |

Say whether Path 1 forces the client to fight CMS payload shape, and whether Path 2 forces the team to **own RLS and ledger RPCs before the UI is nice**.

### 4. Ledger integrity (first-class risk)

Map **this repo’s** rules to implementation:

- Transaction has **both** `debit_account` and `credit_account` (schema relations; not a SQL CHECK today).
- Account **tree** (`parent` / `children`) and org ownership.
- Member **afterCreate → account** lifecycle.
- Draft vs published transactions (Strapi `draftAndPublish`).
- Use cases in [`docs/readme.md`](./readme.md) that year-1 will **not** fully ship (scheduled fees, file import, member self-serve) — list them as **out of year-1**, but say whether the **data model** still allows them later.

Path 1: Strapi lifecycles, policies, custom controllers.  
Path 2: `NOT NULL`, `CHECK`, triggers, RPCs, maybe edge functions.

State which path is **safer for a community ledger in year 1 with a small team**, and why. Integrity can beat DX.

### 5. Schema ownership, SQL inspectability, migrations

- Path 1: Strapi owns table names and document internals; `pg_dump` is possible but ugly to hand-edit; content-type JSON in git is the real schema.
- Path 2: You own `public` tables; migrations (declarative SQL / vendor CLI) are the schema; API is a projection of tables.

Inspect (from docs, not folklore) what a Strapi 5 Postgres schema looks like for relations and draft/publish. Cite URLs.

### 6. Auto API completeness

CRUD, filters, relations/populate, pagination, webhooks, file upload, bulk, transactions (DB transaction / RPC). Note Path 1 REST vs optional GraphQL plugin. Note Path 2 REST vs GQL quality (PostgREST vs Hasura vs Neon Data API).

### 7. Auth and authorization vs org/membership

Map a plausible year-1 matrix: Public / Treasurer / Board / Member (self).  
Path 1: Users & Permissions + Admin roles.  
Path 2: vendor Auth + RLS policies on `organization_id` / membership join.  
Call out **service-role key** leaks and **RLS-off migrations** as Path 2 failure modes; call out **open find** permissions and **Admin = full DB** as Path 1 failure modes.

### 8. Uploads

Path 1 already has Cloudinary. Path 2: vendor storage vs keep Cloudinary. Receipts need files in year 1 if operators attach them on day 1 — say how.

### 9. Local DX

`npm run develop` + Docker Postgres vs vendor local stack (`supabase start`, Hasura, etc.). Seed scripts: [`scripts/seed-database.js`](../scripts/seed-database.js) is Strapi-specific — Path 2 rewrite cost.

### 10. 12-month application-layer TCO (not a hosting bake-off)

| Path 1 | Path 2 |
| --- | --- |
| Fly-class compute (cite hosting doc: about **$0–8/month** autostop 1 GB, or more if always-on) + **$0** Neon Free + Strapi upgrades + `node_modules` **~1.1 GB** + denormalized tables + CI build | Usually API+DB bundled; often **€0** free tier with pause/backup caveats; **no** Node API to patch; SQL/RLS skill pulled **forward**; Studio is not a treasurer UI |

Do **not** reopen Render vs Hetzner. Footnote year-2 vendor cliffs (Supabase Pro **$25**, Neon limits, pause deleting **compute** vs **data**).

### 11. Rewrite cost of *this* schema (keep vs replace)

Path 1: keep content-types; remaining work is deploy + permissions + maybe a few lifecycles for debit/credit.  
Path 2: re-model ~12 collection types as SQL, rewrite member-account rule, re-seed, throw away Strapi Admin/REST, teach operators Studio. **Appsmith remap** is a footnote, not a driver.

### 12. Year-2 exit cost (not a migration plan)

You will not switch this year. Still state cost-of-being-wrong **after month 12**:

- Leave Path 1: export from Strapi/Postgres, lose document tables and Admin, rewrite client off Strapi REST.
- Leave Path 2: `pg_dump` of **your** schema is the asset; throw away RLS/Auth vendor lock; client may keep table-shaped calls if you stay on PostgREST.

This informs which 12-month pick is safer. It is **not** a phased architecture.

### 13. Path 2 vendor shortlist (only if it could change the pick)

**Primary exemplar: Supabase** (Postgres + PostgREST + GraphQL + Auth + RLS + Storage + Studio).

Also verify, with **current 2026** primary docs:

- **Neon Data API** — backend, or still “Postgres for Path 1”?
- **Nhost**, **Hasura Cloud**, others you find that are **PSQL + auto REST/GQL + row security**, fully managed.

**Exclude:** Firebase (not Postgres), PocketBase/SQLite, Appwrite unless you prove Postgres+RLS parity, **plain** Neon/RDS/Render Postgres **without** an application API, self-hosted PostgREST on a VM, Directus/Strapi-class CMS unless you explicitly argue it is Path 2 (it is closer to Path 1 — default **exclude** from Path 2).

If no vendor beats Supabase on **year-1 operator story** or **ledger RPCs**, say so in one paragraph and use Supabase as Path 2.

---

## Scoring dimensions (required table)

Fill one row per path (and extra rows only for Path 2 vendors that could change the pick).

| Dimension | What to put |
| --- | --- |
| Year-1 operator story | Treasurer posts a transaction on day 1; non-dev or not |
| Time to first real transaction | Days/weeks of work from this repo’s current state |
| Ledger integrity | How debit/credit, trees, member→account are enforced |
| Authz vs org/membership | Roles vs RLS; year-1 honest scope (superuser vs row security) |
| Schema ownership / SQL | Who owns tables; inspectability; migrations |
| Auto API | REST/GQL completeness for this domain |
| Future client contract | Payload shape, aggregates, draft/publish, auth |
| Dual-surface tax | Admin/Studio now + custom client later |
| Local DX / seeds | develop loop; seed rewrite |
| Uploads | Cloudinary vs vendor storage |
| App-layer TCO year 1 / year 2 | Euros + ops hours, not a PaaS matrix |
| Rewrite cost now | Keep Strapi vs remodel SQL |
| Year-2 exit cost | Pain if the pick was wrong |
| Data residency | HU / EU / US |
| Verdict | Winner / runner-up; **one** 12-month pick |

---

## Hard filters

- Do not recommend Path 2 if year-1 operators **cannot** enter transactions without a custom client **and** you have not named a shipped stopgap.
- Do not recommend Path 1 “because Admin exists” without scoring dual-surface tax and CMS payload cost on the future client.
- Do not recommend mid-year migration.
- Do not treat Neon Free (hosting winner) as Path 2 unless Data API + auth + RLS is documented as production.
- Do not use SQLite, ephemeral disks, or Firebase as Path 2.
- Do not design the custom client.
- Do not re-run the hosting comparison.

---

## Research rules

1. **Do not rely on training-memory for products, Data API status, free-tier pause/backup, or prices.** Look up **current (2026)** primary docs. Cite **URLs** and a **last-checked date** for every claim that affects the pick.
2. Prefer vendor docs over blogs. If a blog is used, corroborate.
3. Confirm **Strapi 5** (not 4) document schema, Users & Permissions, and draft/publish behaviour.
4. Confirm Path 2 pause behaviour: compute sleep vs **data deletion**; backup/PITR on the free tier (Supabase Free historically: pause ~7 days, **no auto backups** — **verify**, do not copy the hosting doc blindly).
5. Read this repo’s schemas and [`lifecycles.ts`](../src/api/member/content-types/member/lifecycles.ts) before talking about “typical CMS vs typical BaaS.”
6. Prefer the option that keeps **financial transaction data** correct and operable over the option that is slightly cheaper or more fashionable.

---

## Required output

Write the proposal as markdown (a new file under `docs/` is fine if the user asked you to save it; otherwise the chat response is enough unless they specify a path). Structure it for a **CTO**, in this order:

1. **Recommendation** (½–1 page). Path 1 or Path 2. Why. Year-1 cost footnote. **Main risk.** What would have to be true to have picked the other path.
2. **Year-1 operating model** for the winner **and** the runner-up (day-1 transaction entry, who is allowed to click, draft/publish, org scope).
3. **Decision table** (scoring dimensions above). Extra Path 2 vendor rows only if they could change the pick.
4. **90-day sequence if we take the winner.** First experiment, first real transaction, permissions/RLS or Admin roles, uploads, **what we refuse to build yet** (no custom client, no member self-serve, no CSV import unless you argue it is required for day-1 ops — it is not).
5. **Risk register.** Integrity, auth mistakes (open Strapi find vs RLS/service-role), ops (Fly cold start vs BaaS pause), lock-in, operator error in Studio vs Admin.
6. **Year-2 exit cost.** One subsection. Not a migration project plan.
7. **Path 2 shortlist / do not confuse.** Neon-as-DB vs Neon-as-backend; Strapi-not-Prisma; excluded products with one-line reasons.
8. **Code implications** pointing at this repo ([`src/api/`](../src/api/), [`config/database.ts`](../config/database.ts), member lifecycles, Cloudinary, seeds, Users & Permissions). **Do not implement.**

Be concrete. Name products and documented limits. The last sentence of the recommendation should be a **single imperative**: take Path 1 or take Path 2 for the next twelve months.
