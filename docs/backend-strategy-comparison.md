# CURR backend strategy (year 1) — CTO decision proposal

**Status:** research only — no deploy, no schema change, no migration.  
**Last checked:** 2026-09-21 (rev 2: Path 2 year-1 UI includes DBeaver-class remote GUIs for technically skilled accountants). Product limits and prices are from primary vendor docs on that date; they change.  
**Decision locked:** one backend for the next **~12 months**. Mid-year “Strapi now, PostgREST in month 6” is out of bounds.  
**Out of scope:** hosting bake-off ([`cloud-provider-comparison.md`](./cloud-provider-comparison.md) already picked Fly `fra` + Neon FRA for Path 1), custom-client screens, Appsmith/Retool builds.

**Repo facts used:** Strapi **5.27** at repository root (`backend-strapi`), Node **20–22**, REST only (`@strapi/plugin-graphql` is **not** in [`package.json`](../package.json)), Users & Permissions, Cloudinary uploads, Postgres via `DATABASE_URL` in [`config/database.ts`](../config/database.ts), member→account lifecycle in [`src/api/member/content-types/member/lifecycles.ts`](../src/api/member/content-types/member/lifecycles.ts), ~12 collection types under [`src/api/`](../src/api/), `draftAndPublish: true` on `transaction` and `receipt` only.

**Rev 2 operator assumption (Path 2):** year-1 posters are **technically skilled accountants**. A shipped SQL GUI — **DBeaver Community** (desktop), **CloudBeaver** (browser, self-hosted), or the vendor SQL/table editor — is a **named temporary client**, not a custom app. That is allowed by the locked “Studio / SQL / named table UI” rule.

---

## 1. Recommendation

**Take Path 1 for the next twelve months: keep this repository’s Strapi 5.27 app, Postgres on Neon Frankfurt, Node on Fly.io `fra`, treasurers in Strapi Admin, later custom client on Strapi REST.**

Rev 1 leaned on “Studio is too weak for a treasurer.” That argument is **weaker once accountants can use DBeaver**. DBeaver’s Data Editor, foreign-key navigation, References panel, and `SELECT post_transaction(...)` / Execute procedure are a real year-1 posting surface on **owned SQL**. Path 2 is operable for this org. It is still the wrong **12-month pick for this checkout**, because the locked yardstick is the existing Strapi domain, not a greenfield ledger plus a GUI.

Why Path 1 still wins, after giving Path 2 the GUI:

1. **Time to first real transaction is still days vs weeks.** DBeaver does not create the twelve tables, the member→account trigger, or the seed rewrite. Path 1 remaining work is: deploy Fly+Neon, `npm run seed:full`, Treasurer Admin role, Cloudinary (already in [`config/plugins.ts`](../config/plugins.ts)). Path 2 remaining work is unchanged in size: remodel ~12 types as SQL, put the member-account rule in a trigger/RPC **on day 1**, re-seed, discard Admin/REST, issue a **restricted DB role** (not table-owner), teach DBeaver. A better temporary client does not shrink a rewrite.
2. **DBeaver makes Path 2’s ledger *capable* of being stricter, not automatically safer.** Users & Permissions is not a ledger. RLS is not a ledger. DBeaver is not a ledger. In this repo, `debit_account` / `credit_account` are still not `required`. Path 2 *can* revoke `INSERT` on `transactions` and force `SELECT post_transaction(...)` from DBeaver — that is the integrity-winning Path 2 flow, and a skilled accountant can run it. Zero of that SQL exists until you write it. Until then, Data Editor on a naked table is **more** dangerous than Admin’s labeled Tartozik/Követel pickers.
3. **Receipts still favor Admin this year.** Receipt `document` is required media; Cloudinary is wired; Media Library is the year-1 file UI. DBeaver is a row editor. Year-1 Path 2 posting of a nyugta is: upload somewhere (Cloudinary web or vendor Storage), paste a URL. Fine for a technical accountant; slower and easier to skip than Admin.
4. **Admin is still a year-1 bridge, not the product.** Dual-surface tax is now scored **for Path 2 on portability**: DBeaver now + custom client later both sit on **your** tables. That is a real Path 2 win. It does not pay for throwing away this repo in month 1.
5. **TCO stays a footnote.** Path 1: Fly **~$0–8/month** + Neon **$0** ([hosting doc](./cloud-provider-comparison.md)) + DBeaver is unused. Path 2: Neon or Supabase **$0** + **DBeaver Community $0** (no Fly Node). Euros would favor Path 2. Time-to-live-ops still outranks that.

**Main risk of the pick:** future client on a CMS document contract; ugly year-2 dump (`document_id`, `_lnk`). Second: Fly+Strapi+Neon cold start. Third: Super Admin = full DB.

**What would have to be true to have picked Path 2 instead (rev 2):** technical accountants **are now assumed**. Remaining blockers: live ops can wait **4–8 weeks** for SQL + posting function + treasurer role + seed rewrite; receipts-by-URL are acceptable; the existing content-types/seeds/lifecycle are treated as disposable. If those three are also true, Path 2 with **Neon Data API + DBeaver** (not Supabase Studio) would win.

Take Path 1 for the next twelve months.

---

## 2. Year-1 operating model

Usage assumption (locked): about **one or two full CRUD workflows per day**. Almost idle otherwise.

### Winner — Path 1 (Strapi Admin)

**Who clicks what on day 1 to post a transaction**

1. Treasurer signs in at `/admin` (Strapi Admin user, **not** a Users & Permissions end-user).
2. Content Manager → **Transaction** → Create.
3. Fills `date` (required), `amount` (required), `description`, picks `debit_account` and `credit_account` (labeled Tartozik / Követel; **not schema-required today**), `transaction_type`, `currency_type`, optional `receipt` / `related_transaction`.
4. Saves as **draft** or **Publish**. `draftAndPublish` is first-class on `transaction` and `receipt`. REST defaults to published if a later client POSTs without `?status=draft` ([Strapi REST status](https://docs.strapi.io/cms/api/rest/status), last checked 2026-09-21).
5. Optional receipt: create **Receipt** with required media `document` → Cloudinary, then attach.

**Non-developer treasurer without SQL?** Yes. Hungarian labels already exist. DBeaver is **not** the Path 1 year-1 UI — pointing it at Strapi’s document/`_lnk` tables is a residual risk (see R14).

**Draft/publish without the custom client?** Yes, in Admin.

**Org-scoped access?** Honest year-1: **no row security**. Admin RBAC hides content-types, not `membership.organization` rows ([Strapi RBAC](https://docs.strapi.io/cms/features/rbac)). One org after seed; treasurers see the whole ledger.

**Residual risk:** Admin accepts a one-sided debit/credit until relations are marked required. Super Admin can edit the chart of accounts as freely as transactions.

| Role | Path 1 year-1 | Honest scope |
| --- | --- | --- |
| Public | Users & Permissions Public: **keep find/create off** | Open `find` is the Path 1 leak. |
| Treasurer | Admin role: Content Manager on transaction/receipt/member; read on accounts/types | Whole ledger. |
| Board | Same or read-only Admin | No generated reports. |
| Member (self) | **Out of year-1** | Custom client later. |

### Runner-up — Path 2 (DBeaver as temporary client)

Named stopgap: **DBeaver Community** against the managed Postgres (Neon Data API or Supabase). Online alternatives in the shortlist below. Not a custom app.

**Who clicks what on day 1** (day 1 of a *live* Path 2 project, after SQL remodel)

1. Accountant opens **DBeaver**, connection to Neon/Supabase: host, port **5432**, database, role, password in separate fields (JDBC does not like a full URL). SSL `require`. Neon keep-alive **60 seconds** so scale-to-zero does not drop the session ([Neon GUI](https://neon.com/docs/connect/connect-postgres-gui), last checked 2026-09-21).
2. Connect as role **`treasurer`**, not `postgres` / table owner (that role bypasses RLS and can `DROP`).
3. **Preferred posting path (integrity):** SQL Editor saved script or right-click function → Execute: `SELECT * FROM post_transaction(p_date := ..., p_amount := ..., p_debit := ..., p_credit := ..., p_type := ..., p_currency := ...)`. Table `INSERT` on `transactions` is **revoked**. This is why a skilled accountant + DBeaver can beat Admin on correctness — *after* that function exists.
4. **Fallback posting path (grid):** Data Editor on `transactions`. Fill date/amount; resolve debit/credit via foreign-key navigation / References panel ([CloudBeaver References](https://dbeaver.com/docs/cloudbeaver/References-Panel/), since 26.2; DBeaver desktop Navigate → Referencing tables). Filter `status = 'draft'`. This is still a generic grid: null debit, debit = credit, wrong org account unless CHECK/FK exist.
5. Optional receipt: upload the file in Cloudinary (or vendor Storage) **outside** DBeaver; paste the URL into `receipts`; set the FK. DBeaver is not a media library.

**Non-developer treasurer without SQL?** Not the Path 2 operator. A technical accountant can post from the Data Editor without writing SQL, and can call a posting function with bound parameters (DBeaver’s Execute procedure dialog). Raw `psql` is the floor; DBeaver is the intended stopgap.

**Draft/publish without the custom client?** Only with a `status` (or `posted_at`) column you model. Data Editor filters on it. No Strapi-style draft row pair.

**Org-scoped access?** Possible: `treasurer` is `NOBYPASSRLS`, RLS on `organization_id` / membership, plus `GRANT` only on needed tables/views/functions. Honest year-1 if you skip that work: DBeaver as owner = **superuser on the ledger**, worse than a constrained Admin role.

**Residual risk:** laptop holds the DB password; a third-party **hosted** SQL IDE proxies query traffic (avoid); Data Editor on unrestricted `INSERT` recreates the old Studio problem; receipts get skipped; Neon/Supabase IP allowlists vs home ISPs.

---

### Path 2 GUI shortlist (temporary client only)

| Tool | Kind | Use for CURR year-1 | Do not |
| --- | --- | --- | --- |
| **DBeaver Community** | Desktop, $0 | **Primary Path 2 stopgap.** Neon-tested. Data Editor + FK navigation + function execute. Credentials stay on the accountant’s machine; data stays in FRA Postgres. | Point it at Path 1 Strapi tables as the posting UI. |
| **CloudBeaver Community** | Browser, **self-host** (Docker) or AWS Marketplace AMI (~$0.05/h Community) | Shared online GUI if accountants should not install desktop software. Host the AMI in **`eu-central-1`** if you go AWS. Centralizes connection secrets. | Treat Marketplace CloudBeaver as free SaaS — you still run a server. Extra ops on a no-budget year. |
| **Neon SQL Editor + Tables** (Drizzle Studio) | Vendor web, data in FRA | Fine if Path 2 is Neon Data API. Weaker FK posting UX than DBeaver; no extra product. | |
| **Supabase Table Editor / SQL Editor** | Vendor web, pick `eu-central-1` | Fine if Path 2 is Supabase. | |
| **pgAdmin 4, DataGrip, TablePlus, Beekeeper** | Desktop | Neon-tested substitutes ([GUI list](https://neon.com/docs/connect/connect-postgres-gui)). Same role as DBeaver. | |
| **Third-party hosted SQL IDEs** (browser SaaS that proxies Postgres) | Online | **Last resort.** Query text and row data leave FRA for that vendor. Mark residency US-unknown unless they publish an EU region. | Default for a Hungarian community ledger. |

With DBeaver as the year-1 UI, **Path 2’s vendor no longer needs the best Studio**. Neon Data API (already FRA, sleep **keeps data**, REST+JWT+RLS documented) becomes the **preferred Path 2 backend**; Supabase remains the richer Auth/Storage/GQL bundle. Neither beats Path 1 on rewrite cost.

---

## 3. Decision table

Scoring is Path 1 vs Path 2 **as the 12-month backend**. Path 2 year-1 UI is **DBeaver Community** (CloudBeaver / vendor editors as online fallbacks). Path 2 **host** if we had picked it: **Neon Data API in Frankfurt** (continuity with the hosting doc); Supabase is the alternate bundle.

| Dimension | Path 1 — Strapi 5.27 + Neon FRA + Fly `fra` | Path 2 — Neon Data API (or Supabase) + DBeaver stopgap | Winner |
| --- | --- | --- | --- |
| **Year-1 operator story** | Admin; Hungarian labels; non-dev yes | Technical accountant in DBeaver Data Editor or `post_transaction()`; non-dev not required | **Path 1** (labels + receipts); Path 2 **viable** |
| **Time to first real transaction** | **Days:** Fly+Neon, `seed:full`, Admin user | **Weeks:** 12 tables, trigger, seed rewrite, `treasurer` role, DBeaver connection, posting function | **Path 1** — **unchanged by the GUI** |
| **Ledger integrity** | Relations exist; **not required**; member lifecycle in JS; no CHECK | Can be strongest: `NOT NULL`/`CHECK`, revoke table `INSERT`, DBeaver calls RPC. Until written, Data Editor is worse than Admin | **Path 2 if SQL ships first**; **Path 1 on day 1 of this repo** |
| **Authz vs org/membership** | Admin RBAC; no row scope; Public `find` leak | DB role + RLS; DBeaver as owner bypasses it. Later client: vendor Auth + `auth.uid()` | **Draw** year-1; Path 2 better *if* `treasurer` is unprivileged |
| **Schema ownership / SQL** | Strapi owns `document_id` / `published_at` / `locale` ([docs](https://docs.strapi.io/cms/migration/v4-to-v5/breaking-changes/database-columns)), `_lnk` / hashed ids ([docs](https://docs.strapi.io/cms/migration/v4-to-v5/breaking-changes/database-identifiers-shortened)). Git JSON is the schema | You own `public`. DBeaver inspects the same tables the later client will call | **Path 2** |
| **Auto API** | REST, populate, upload, webhooks. No GraphQL unless added. No posting RPC | Neon: PostgREST Data API + `.rpc()`. Supabase: PostgREST + `pg_graphql`. Views for balances | **Path 2** for the later client |
| **Future client contract** | Flattened REST, `documentId`, populate, `status` ([REST](https://docs.strapi.io/cms/api/rest)). CMS shape tax | Table JSON / GQL. Must own RLS and ledger RPCs before the UI is nice. DBeaver already trained the team on those tables | **Path 2** |
| **Dual-surface tax** | Admin now + client later on **CMS document API**. Permission drift, upgrade churn | DBeaver now + client later on **owned SQL**. GUI is not the product; schema is portable. **Rev 2: Path 2 wins this row more clearly** | **Path 2** |
| **Local DX / seeds** | `npm run develop` + Docker PG 16. Strapi seeder | `supabase start` or Neon branch + DBeaver. Seed rewrite to SQL | **Path 1** |
| **Uploads** | Cloudinary in Admin | Cloudinary or Storage **outside** DBeaver; URL in a column | **Path 1** |
| **App-layer TCO year 1 / year 2** | Fly **~$0–8/mo** + Neon **$0** + Strapi upgrades + 1.1 GB image | Neon **$0** (or Supabase Free **$0** / Pro **$25**) + DBeaver **$0**. No Node API. CloudBeaver AWS is extra if you insist on browser | **Path 2** on euros |
| **Rewrite cost now** | Keep content-types | Re-model ~12 types, rewrite lifecycle, re-seed, throw away Admin, teach DBeaver | **Path 1** |
| **Year-2 exit cost** | Ugly dump; rewrite client off Strapi REST | `pg_dump` of **your** schema; drop vendor Auth helpers; DBeaver still works on the next host | **Path 2** |
| **Data residency** | Neon FRA + Fly `fra` | Neon FRA, or Supabase **`eu-central-1` specific**. DBeaver desktop: data stays in FRA. CloudBeaver/AMI: pick Frankfurt. Hosted third-party GUIs: unmarked | **Draw** if GUI is desktop or vendor-native |
| **Verdict** | **Winner — 12-month pick** | Runner-up — viable operator story with DBeaver; rewrite still too expensive *this year* | **Path 1** |

---

## 4. 90-day sequence if we take the winner

This is a sequence, not a migration off Strapi. DBeaver is **not** in the Path 1 critical path.

| Window | Do | Do not |
| --- | --- | --- |
| **Days 1–14 — first experiment** | Hosting doc: Neon `aws-eu-central-1`, Fly `fra`, CI image, autostop, 1 GB. Hit `/_health` and `/admin` twice (cold/warm). | Do not post production rows through DBeaver into Strapi tables. Do not enable GraphQL. Do not design the custom client. |
| **Days 14–30 — first real transaction** | `npm run seed:full`. Treasurer Admin role (no Content-Type Builder). One live fee in Admin. | Do not open Public `find`. Do not invite members as Admin. |
| **Days 30–60 — integrity and uploads** | Mark `debit_account` / `credit_account` **required**. Optional transaction lifecycle. Real receipt via Cloudinary. | Do not write a SQL posting RPC “for later Path 2.” Do not add Appsmith against production. |
| **Days 60–90 — freeze and dumps** | Public all **off**. Weekly `pg_dump` of Neon. Rehearse cold-start Admin. | **Refuse:** custom client, member self-serve, CSV import, scheduled fees, project-balance API, org-scoped Admin. Data model still allows them later. |

---

## 5. Risk register

| ID | Risk | Path | Likelihood × impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Unbalanced / one-sided transaction | Both | High × High | Path 1: required relations. Path 2: posting function + revoke `INSERT` — only if SQL is written. |
| R2 | Public `find` on `transaction` / `member` | Path 1 | Medium × High | Default-deny after every deploy. |
| R3 | Super Admin / DB owner edits live ledger | Both | High × Medium | Admin Treasurer role; Path 2 `treasurer` with `NOBYPASSRLS`. |
| R4 | Fly + Strapi + Neon cold start | Path 1 | High × Low at 1–2 CRUD/day | Accept or always-on ~$8. |
| R5 | 1 GB Fly RSS at serve time | Path 1 | Medium × Medium | Bump RAM (hosting doc). |
| R6 | Strapi document internals in a year-2 dump | Path 1 | Certain × Medium (year 2) | `schema.json` is source of truth. |
| R7 | Dual-surface permission drift | Path 1 | High in year 2 × Medium | Freeze Users & Permissions unused in year 1. |
| R8 | Service-role / RLS-off / owner DBeaver | Path 2 | High if Path 2 × High | Why Path 2 still needs a restricted role **before** first insert. |
| R9 | Supabase Free pause / no backups | Path 2 (Supabase) | Medium | Prefer Neon Data API if Path 2; or Pro $25; DIY dumps. |
| R10 | Operator error in Data Editor (no RPC) | Path 2 | High until RPC exists × High | Do not treat DBeaver grid as a posting wizard. |
| R11 | Member created without account | Path 1 | Low × Medium | Existing lifecycle; seed org first. Path 2: trigger on day 1. |
| R12 | Cloudinary missing in Fly | Path 1 | Medium × Medium | Copy env from Render. |
| R13 | Vendor lock-in | Both | Certain × deferred | §6. |
| **R14** | **DBeaver pointed at Strapi tables** | Path 1 | Medium × High | Draft/published **pairs**, `_lnk` joins, hashed names. Easy to edit the wrong row or skip publish. **Do not use DBeaver as Path 1’s treasurer UI.** |
| **R15** | **DB password on laptops / third-party hosted GUI** | Path 2 | High × High | Desktop DBeaver or vendor editor. No PopSQL-class proxy. Rotate the `treasurer` password. Neon SSL required. |
| **R16** | **Neon scale-to-zero drops DBeaver** | Path 2 (Neon) | High × Low | Keep-alive 60s ([Neon GUI](https://neon.com/docs/connect/connect-postgres-gui)). |

---

## 6. Year-2 exit cost

Not a migration plan. Cost of being wrong **after month 12**.

**If Path 1 was wrong:** a year of ledger rows in Strapi-shaped Postgres. Exit: `pg_dump`, collapse draft/published pairs, resolve `_lnk`, discard Admin, rewrite the client off flattened REST. DBeaver does not help much here — the tables are still document-shaped. Pain is real; it is twelve months of operations later.

**If Path 2 was wrong:** `pg_dump` of *your* tables is the asset. Throw away vendor Auth/`auth.uid()`. The later client and **DBeaver both keep working** against the next Postgres (self-hosted PostgREST, another Neon project, etc.). Lower data pain.

Rev 2 note: DBeaver **lowers Path 2 exit cost further** (the temporary client is already schema-native). It does **not** lower Path 1 exit cost. That still does not justify paying the rewrite **this** year.

---

## 7. Path 2 shortlist / do not confuse

**With DBeaver as year-1 UI, Neon Data API is the Path 2 host to beat**, not Supabase Studio. Ledger RPCs are plain Postgres either way. Operator story is the GUI, not the vendor dashboard. Supabase still wins if you want Auth+Storage+GQL in one vendor; it does not win on pause/backups vs Neon.

### Neon Data API — preferred Path 2 *if* Path 2 had won

Production REST (PostgREST), JWT (Managed Better Auth or JWKS), RLS (`auth.user_id()` / `auth.uid()`), `.rpc()` ([get started](https://neon.com/docs/data-api/get-started)). DBeaver uses the **wire protocol**, not the Data API — accountants and the later client use different doors into the same tables. Limits: per-branch, one database, no IP Allow with Data API, no bundled object storage (keep Cloudinary). Sleep **does not delete data**. **Does not change the 12-month pick:** you still drop Strapi and remodel.

### Supabase

Still the richest bundle (Studio, Storage, `pg_graphql`, Auth). Free: pause ~7 days, **no auto backups**, 500 MB ([pricing](https://supabase.com/pricing.md)). Pick **`eu-central-1`**, not generic Europe ([regions](https://supabase.com/docs/guides/platform/regions)). DBeaver connects the same way as to Neon. Use if you want Storage/GQL more than Neon continuity.

### Nhost / Hasura Cloud

Unchanged: GraphQL-first / BYO-DB overlay. DBeaver can still post to the underlying Postgres. Does not beat Neon+DBeaver on year-1 ops or ledger RPCs.

### Excluded (one line each)

| Product | Why excluded |
| --- | --- |
| **Firebase** | Not Postgres. |
| **PocketBase / SQLite** | Not Postgres. |
| **Appwrite** | Not proven Postgres+RLS parity. |
| **Plain Neon / RDS without Data API or PostgREST** | Storage only — unless Data API is enabled (then it is Path 2). |
| **Self-hosted PostgREST on a VM** | You run the API process. |
| **Directus** | CMS; closer to Path 1. |
| **Hosted third-party SQL IDEs as the system of record UI** | Proxy + residency. Allowed only with an EU DPA; default no. |
| **Prisma** | **Strapi 5 is not Prisma.** Document tables come from Strapi’s document service. |

---

## 8. Code implications (do not implement)

| Area | Path 1 (this year’s pick) | Path 2 (rejected; DBeaver would be the year-1 client) |
| --- | --- | --- |
| [`src/api/`](../src/api/) | **Keep** `schema.json`. | SQL migrations; DBeaver sees those tables. |
| [`transaction` schema](../src/api/transaction/content-types/transaction/schema.json) | Mark debit/credit **required** in days 30–60. | `NOT NULL` FKs, `CHECK`, `post_transaction()`; revoke `INSERT` from `treasurer`. |
| [`receipt`](../src/api/receipt/content-types/receipt/schema.json) | Stock factories; Admin + Cloudinary. | URL column; upload outside DBeaver. |
| [`lifecycles.ts`](../src/api/member/content-types/member/lifecycles.ts) | **Keep.** | `BEFORE INSERT` trigger on day 1. |
| [`account` tree](../src/api/account/content-types/account/schema.json) | CMS relations. | `parent_id` + `organization_id`; DBeaver References panel follows FKs. |
| [`config/database.ts`](../config/database.ts) | Neon pooled URL; pool min 0–1. | Unused Node. DBeaver uses **direct** (not pooled) for GUI sessions. |
| [`config/plugins.ts`](../config/plugins.ts) | Cloudinary stays. | Cloudinary or Storage. |
| [`package.json`](../package.json) | Stay on Strapi 5.27. | Drop Node API. |
| [`scripts/seed-database.js`](../scripts/seed-database.js) | Keep. | SQL/`COPY`; DBeaver can run the script. |
| Users & Permissions | Public closed. | `treasurer` DB role + later vendor Auth. |
| `apps/frontend-appsmith/` | Footnote. | Footnote. |
| [`docs/readme.md`](./readme.md) | Self-serve, schedule, import, reports: **out of year-1**. | Same; SQL views would help later. |

---

## Sources (last checked 2026-09-21)

- Strapi 5 REST / status / document columns / identifiers / Users & Permissions / RBAC: https://docs.strapi.io/cms/api/rest · https://docs.strapi.io/cms/api/rest/status · https://docs.strapi.io/cms/migration/v4-to-v5/breaking-changes/database-columns · https://docs.strapi.io/cms/migration/v4-to-v5/breaking-changes/database-identifiers-shortened · https://docs.strapi.io/cms/features/users-permissions · https://docs.strapi.io/cms/features/rbac
- Neon Data API / Tables / GUI (DBeaver keep-alive 60s): https://neon.com/docs/data-api/get-started · https://neon.com/docs/data-api/access-control · https://neon.com/docs/guides/tables · https://neon.com/docs/connect/connect-postgres-gui
- DBeaver / CloudBeaver: https://dbeaver.com/docs/cloudbeaver/Data-editor/ · https://dbeaver.com/docs/cloudbeaver/References-Panel/ · https://dbeaver.com/docs/dbeaver/SQL-Execution/ · https://dbeaver.com/docs/cloudbeaver/AWS-Overview/
- Supabase pricing / pause / backups / regions / GraphQL / RLS: https://supabase.com/pricing.md · https://supabase.com/docs/guides/platform/free-project-pausing · https://supabase.com/docs/guides/platform/backups · https://supabase.com/docs/guides/platform/regions · https://supabase.com/docs/guides/graphql · https://supabase.com/docs/guides/database/postgres/row-level-security
- Nhost / Hasura: https://nhost.io/pricing · https://hasura.io/docs/2.0/hasura-cloud/plans/
- Path 1 hosting TCO: [`cloud-provider-comparison.md`](./cloud-provider-comparison.md)

**Take Path 1 for the next twelve months.**
