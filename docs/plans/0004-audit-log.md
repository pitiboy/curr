# Implementation plan: Audit log (HTTP endpoint szint)

**Status:** proposed
**Date:** 2026-11-08
**Döntés:** [ADR 0002: Audit log](../adr/0002-audit-log.md)
**Érintett kód:** [`config/middlewares.ts`](../../config/middlewares.ts), [`config/server.ts`](../../config/server.ts), [`src/publish-guard.ts`](../../src/publish-guard.ts) (`contentApiActor`)

Ezt a fájlt egy másik agent hajtja végre. A v1 az **endpoint-szintű** audit: egy globális Koa middleware minden releváns HTTP kérésről egy sort ír. A dokumentum-szintű audit (Document Service middleware) a [V2 javaslat](#v2-javaslat-document-service-audit-d-opció) szekcióban szerepel, és **nem** része a v1-nek.

---

## Hogyan kell végrehajtani

- Egyszerre egy számozott lépést kell elvégezni, a lépés végén lévő ellenőrzéssel.
- Egy lépés végén az agent kipipálja a saját négyzeteit, és **megáll** a Human sor előtt.
- Ha az ellenőrzés elbukik, a következő agent ugyanennek a lépésnek a javítását végzi, nem lép tovább.
- Az audit **soha** nem törhet el üzleti kérést. Minden audit-hibát el kell nyelni, és `strapi.log.warn`-nal kell logolni.
- Új npm függőség nem kerül be. A Strapi beépített pino loggerét, a `strapi.db.query`-t és a `node:crypto`-t kell használni.

Helyben a Strapi a `http://localhost:1337` címen, az SPA a `http://localhost:5173/backoffice/` címen fut.

---

## 1. Cél és nem-cél

### Cél

1. Minden írási kérésről (POST/PUT/PATCH/DELETE) egy audit sor keletkezik a `/api/`, `/admin/` és `/content-manager/` útvonalak alatt. A sor tartalma: ki, mikor, melyik endpointot hívta, mit küldött (redaktálva), milyen státusszal és mennyi idő alatt.
2. A **login endpointok** metódustól és eredménytől függetlenül naplózódnak, a sikertelen kísérletek is.
3. Az audit sorok az admin panelen böngészhetők (Content Manager → Audit log).
4. Minden kapcsoló env-ből állítható (12-faktor III).
5. Minden esemény strukturált JSON sorként a stdoutra is kikerül (12-faktor XI), így egy későbbi log-aggregátor kódváltoztatás nélkül rácsatlakoztatható.

### Nem-cél (v1)

- A dokumentum-szintű diff („mi változott a rekordban”) a V2 része.
- A GET kérések alapból nem naplózódnak; env-ben bekapcsolhatók.
- A response body nem tárolódik (adatvédelmi és méretbeli okokból).
- Nincs külső SaaS sink. A stdout stream ezt később lehetővé teszi.
- Nincs backoffice UI az audit loghoz. Ha kell, később csak olvasó listaként jöhet.

---

## 2. Opció-értékelés (összefoglaló)

| #     | Opció                        | Backoffice-hívásokat lefedi | Actor    | Mi változott  | Portábilis (sqlite/pg) | Döntés                                              |
| ----- | ---------------------------- | --------------------------- | -------- | ------------- | ---------------------- | --------------------------------------------------- |
| A     | Strapi Enterprise Audit Logs | ✗ (csak admin panel)        | admin    | ✔             | ✔                      | elvetve: fizetős, a content API-t nem fedi          |
| B     | Community plugin             | változó                     | változó  | változó       | ?                      | elvetve: v5.58-on karbantartási kockázat            |
| **C** | **Globális Koa middleware**  | ✔                           | ✔        | request body  | ✔                      | **v1**                                              |
| D     | Document Service middleware  | ✔ (+ admin, seederek)       | ✔        | ✔ szemantikus | ✔                      | **V2**                                              |
| E     | `db.lifecycles.subscribe`    | részben                     | nehézkes | nyers sor     | ✔                      | elvetve: bulk/raw lyukak                            |
| F     | Postgres trigger / pgaudit   | ✔                           | ✗        | ✔ diff        | ✗                      | elvetve: sqlite-on nem fut, cPanel-en DB-admin kell |
| G     | Proxy access log             | ✔                           | ✗        | ✗             | –                      | elvetve: cPanel-en nem kontrollálható               |
| H     | Pino → SaaS                  | (C-n keresztül)             | (C)      | (C)           | ✔                      | későbbi sink-opció                                  |

A 12-faktoros indoklás az [ADR 0002](../adr/0002-audit-log.md)-ben található.

---

## 3. Fogalomtár

| Fogalom    | Jelentés                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| audit sor  | egy HTTP kérés egy rekordja az `audit-log` táblában                                                          |
| sink       | az esemény célja: `db` (audit-log tábla), `stdout` (pino JSON) vagy `both`                                   |
| actor      | a kérést indító fél: `user` (users-permissions JWT), `admin` (admin JWT), `api-token`, `anonymous`           |
| request id | a kérés azonosítója. Az `X-Request-Id` headerből jön, vagy generált UUID. A response headerben is visszamegy |
| redakció   | érzékeny kulcsok értékének `[REDACTED]`-re cserélése rekurzívan a body-ban és a query-ben                    |

---

## 4. Konfiguráció (env)

Az alábbi változókat a `.env.example`-be is fel kell venni, kommenttel.

| Változó                    | Alapérték                                                                                                                                       | Jelentés                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `AUDIT_LOG_ENABLED`        | `true`                                                                                                                                          | főkapcsoló                                            |
| `AUDIT_LOG_SINK`           | `both`                                                                                                                                          | `db` \| `stdout` \| `both`                            |
| `AUDIT_LOG_METHODS`        | `POST,PUT,PATCH,DELETE`                                                                                                                         | naplózott metódusok; a `GET` opt-in                   |
| `AUDIT_LOG_PATH_PREFIXES`  | `/api/,/admin/,/content-manager/`                                                                                                               | csak ezek alatt naplóz                                |
| `AUDIT_LOG_ALWAYS_PATHS`   | `/api/auth/local,/api/auth/local/register,/admin/login,/admin/register-admin,/api/auth/google/callback`                                         | metódustól függetlenül mindig naplózódnak (login)     |
| `AUDIT_LOG_EXCLUDE_PATHS`  | `/_health,/admin/renew-token`                                                                                                                   | sosem naplózódnak (prefix-egyezés)                    |
| `AUDIT_LOG_INCLUDE_BODY`   | `true`                                                                                                                                          | a request body tárolása                               |
| `AUDIT_LOG_MAX_BODY_BYTES` | `8192`                                                                                                                                          | a body csonkolási határa (JSON string hossza)         |
| `AUDIT_LOG_REDACT_KEYS`    | `password,currentPassword,passwordConfirmation,newPassword,token,jwt,secret,code,access_token,refresh_token,id_token,apiKey,resetPasswordToken` | rekurzív, kis- és nagybetűtől független kulcs-egyezés |
| `AUDIT_LOG_RETENTION_DAYS` | `365`                                                                                                                                           | ennél régebbi sorok napi törlése; `0` = nincs purge   |

Megjegyzések:

- **Miért kell a `/content-manager/` prefix?** Strapi 5-ben az admin panel tartalomírásai a `/content-manager/*` alatt futnak, az `/admin/*` alatt csak az admin core (login, users, roles, settings) található. Admin-oldali lefedettséghez mindkét prefix kell.
- Az `/admin/` GET-forgalma (panel-betöltés) alapból nem naplózódik, mert a GET nincs az `AUDIT_LOG_METHODS`-ban.
- A Google OAuth callback GET kérés, és a query-ben `access_token` érkezik. Ezért az `AUDIT_LOG_ALWAYS_PATHS`-ban szerepel, a query-redakció pedig kötelező.
- A login body `identifier` és `email` mezője **nincs** redaktálva, mert sikertelen loginnál ebből derül ki, ki próbálkozott.

---

## 5. Lépések

### 1. Config-parse (tiszta függvény)

- [ ] `src/audit/config.ts`: `readAuditConfig(env: Record<string, string | undefined>): AuditConfig`. Parse-olja a vesszővel elválasztott listákat (trim, üres elemek eldobása), a boolean és int értékeket, és alkalmazza a fenti alapértékeket. Érvénytelen `AUDIT_LOG_SINK` esetén `both` legyen és ne dobjon, a figyelmeztetést a hívó logolja.
- [ ] `src/audit/config.ts`: `shouldAudit(cfg, method, path): boolean`. Sorrend: (1) ha `!enabled` → false; (2) ha exclude-prefix egyezik → false; (3) ha always-path pontosan egyezik (query nélkül) → true; (4) ha van prefix-egyezés és a metódus a listában van → true; (5) egyébként false.
- [ ] `src/audit/config.test.ts`: alapértékek, üres env, egyedi listák, a `shouldAudit` minden ága (például `GET /api/auth/google/callback` → true, `GET /api/transactions` → false, `POST /_health` → false, `DELETE /content-manager/collection-types/...` → true).

**Ellenőrzés:** az `npm test` zöld.

- [ ] Human: a config-táblázat és a viselkedés egyezik.

### 2. Redakció és csonkolás

- [ ] `src/audit/redact.ts`: `redact(value: unknown, keys: Set<string>): unknown`. Rekurzívan bejárja az objektumokat és tömböket, és ha a kulcs (lowercase) benne van a halmazban, az értéket `'[REDACTED]'`-re cseréli. Ciklusvédelemhez `WeakSet`-et használ, mélységkorlátja 20. A `Buffer`, a stream és a file objektumok helyére `'[BINARY]'` kerül.
- [ ] `src/audit/redact.ts`: `truncateJson(value, maxBytes): { value: unknown; truncated: boolean }`. Ha a `JSON.stringify` hossza nagyobb a limitnél, a visszatérési érték `{ _truncated: true, preview: <első maxBytes karakter> }`.
- [ ] `src/audit/redact.test.ts`: beágyazott jelszó, tömbben lévő token, kis- és nagybetű-eltérés, ciklikus objektum, csonkolás, valamint az, hogy az `identifier`/`email` érintetlen marad.

**Ellenőrzés:** az `npm test` zöld.

- [ ] Human

### 3. Actor-feloldás (közös helper)

- [ ] `src/audit/actor.ts`: `resolveActor(ctx): AuditActor` szinkron függvény (nem kérdez DB-t), a `ctx.state` alapján:
  - `ctx.state.auth?.strategy?.name === 'users-permissions'` esetén `{ type: 'user', id: user.id, label: user.email ?? user.username, role: user.role?.type }`
  - `'admin'` esetén `{ type: 'admin', id, label: email, role: roles?.map(r => r.code).join(',') }`
  - `'api-token'` esetén `{ type: 'api-token', id: credentials?.id, label: credentials?.name }`
  - egyébként `{ type: 'anonymous' }`
- [ ] Login-speciális eset ugyanebben a fájlban: `resolveLoginActor(ctx, path, body)`. Ha a path egy always-path és az actor `anonymous`:
  - az `actor_label` a `body.identifier ?? body.email`
  - ha a státusz 2xx, az `actor_id` a `ctx.body?.user?.id` (users-permissions) vagy a `ctx.body?.data?.user?.id` (admin)
  - **a response body többi része nem kerül tárolásra** (a jwt sem)
- [ ] Ha a `role` nincs populálva a `ctx.state.user`-en, az `actor_role` `null`. A v1 nem tesz plusz DB-lekérdezést, mert az egyszerűség és a teljesítmény az elsődleges.
- [ ] A [`src/publish-guard.ts`](../../src/publish-guard.ts) `contentApiActor()` függvényt **nem** kell átírni a v1-ben, mert annak DB-ből betöltött role kell. A közös rész (strategy name és user id kiolvasása) kiemelhető egy `authStrategyOf(ctx)` helperbe, de ez opcionális.
- [ ] `src/audit/actor.test.ts`: mind a négy actor-típus, sikeres és sikertelen login (user és admin).

**Ellenőrzés:** az `npm test` zöld.

- [ ] Human

### 4. Tároló: `audit-log` content type

- [ ] `src/api/audit-log/content-types/audit-log/schema.json`:
  - `kind: collectionType`, `collectionName: audit_logs`, `draftAndPublish: false`
  - `pluginOptions: { "content-manager": { "visible": true }, "content-type-builder": { "visible": false } }`
  - attribútumok:
    - `occurred_at` (datetime, required)
    - `request_id` (string)
    - `method` (string, required)
    - `path` (string, required)
    - `route` (string)
    - `query` (json)
    - `status` (integer)
    - `duration_ms` (integer)
    - `actor_type` (enumeration: `user`, `admin`, `api-token`, `anonymous`)
    - `actor_id` (string)
    - `actor_label` (string)
    - `actor_role` (string)
    - `ip` (string)
    - `user_agent` (text)
    - `body` (json)
    - `error` (text)
- [ ] Minimális `controllers`/`services`/`routes` a Strapi core factory-kkal (`factories.createCoreRouter` stb.).
  - A users-permissions szerepköröknek **nem** kap jogot: a [`src/index.ts`](../../src/index.ts) bootstrap seedere ne adjon rá permissiont.
  - Az admin panelen alapból a Super Admin látja, további admin szerepkörök az admin RBAC-ban kaphatnak jogot.
- [ ] Írás kizárólag `strapi.db.query('api::audit-log.audit-log').create({ data })` hívással történik, a Document Service megkerülésével. Így a V2 document-middleware nem auditálja saját magát, és nincs rekurzió.
- [ ] Index: az `occurred_at`-re és a `request_id`-re. Ha a Strapi schema nem támogatja, maradhat index nélkül; a v1-ben ez nem blokkoló.

**Ellenőrzés:**

- `npm run build` zöld.
- `npm run develop` mellett a Content Manager-ben látszik az „Audit log” típus.
- `GET /api/audit-logs` JWT-vel 403-at ad.

- [ ] Human

### 5. Sink és middleware

- [ ] `src/audit/sink.ts`: `writeAuditEntry(strapi, cfg, entry)`.
  - `stdout` vagy `both` esetén: `strapi.log.info({ audit: entry }, 'audit')`. Ez egy JSON sor, prodban pino formátumban.
  - `db` vagy `both` esetén: `await strapi.db.query(UID).create({ data: entry })`.
  - Mindkettő `try/catch`-ben fut, hiba esetén `strapi.log.warn({ err }, 'audit write failed')`. A DB-hiba nem akadályozza a stdout-írást.
- [ ] `src/middlewares/audit-log.ts` (Strapi middleware factory: `(config, { strapi }) => async (ctx, next) => {...}`):
  1. A `cfg` (`readAuditConfig(process.env)`) egyszer, a factoryban kerül beolvasásra.
  2. Ha `!shouldAudit(cfg, ctx.method, ctx.path)`, akkor `return next()`.
  3. `requestId = ctx.get('x-request-id') || crypto.randomUUID()`, majd `ctx.state.requestId = requestId` és `ctx.set('X-Request-Id', requestId)`.
  4. `const started = Date.now()`, a body és a query snapshot még a `next()` **előtt** (a redakció a mentéskor történik).
  5. `let error; try { await next(); } catch (e) { error = e; throw e; } finally { ... }`
     - `status = error ? (error.status ?? 500) : ctx.status`
     - az actor a `resolveActor` / `resolveLoginActor` alapján
     - az entry összeállítása, redakció, csonkolás
     - **`await writeAuditEntry(...)`**: az írás a válasz előtt fut, így Passenger restartkor sem vész el (12-faktor IX), a hibákat a sink elnyeli
  6. `route`: a `ctx._matchedRoute`, ha van, különben `null`.
  7. `ip`: a `ctx.request.ip`. A `proxy.koa` be van kapcsolva, így ez a valós kliens-IP.
- [ ] [`config/middlewares.ts`](../../config/middlewares.ts): a `strapi::body` **után** és a `strapi::session` **előtt** kerüljön be ez az elem:

  ```ts
  { name: 'global::audit-log', resolve: './src/middlewares/audit-log' },
  ```

  Indoklás:
  - A body ekkor már parsolva van.
  - A `strapi::errors` kívül esik rajta, így a dobott hibákat a `finally` látja.
  - A route-auth a `next()` alatt fut, így az actor a `finally`-ban már ismert.

- [ ] `.env.example`: az összes `AUDIT_LOG_*` változó felvétele kommenttel és alapértékkel.

**Ellenőrzés:**

- `npm run develop`, a backoffice-ból bejelentkezés, majd egy tranzakció létrehozása, publikálása és `convert`-je.
- Az Audit logban egy sor jelenik meg kérésenként, helyes `actor_label`, `actor_type=user`, `status` és `request_id` mezőkkel. A `X-Request-Id` a response-ban is ott van.
- A `POST /api/auth/local` rossz jelszóval egy `status=400`, `actor_type=anonymous`, `actor_label=<identifier>` sort ad, a `body.password` értéke `[REDACTED]`.
- A sikeres login sorában van `actor_id`, a jwt sehol nem jelenik meg.
- Admin panelen egy rekord szerkesztése `actor_type=admin` sort ad a `/content-manager/...` path-szal.
- A stdoutban (dev: pino-pretty) megjelenik az `audit` logsor.

- [ ] Human

### 6. Retenció (cron)

- [ ] `src/audit/retention.ts`: `purgeAuditLog(strapi, days)`, amely ha `days > 0`, a `strapi.db.query(UID).deleteMany({ where: { occurred_at: { $lt: cutoff } } })` hívással töröl, és logolja a törölt sorok számát.
- [ ] [`config/server.ts`](../../config/server.ts): `cron: { enabled: true, tasks: { auditLogRetention: { task: ({ strapi }) => purgeAuditLog(strapi, cfg.retentionDays), options: { rule: '0 3 * * *' } } } }`. A taskot külön fájlból (`config/cron-tasks.ts`) kell importálni.
- [ ] Megjegyzés a dokumentációba: Passengeren a cron csak akkor fut, ha a process él. Ez elfogadható, mert a purge idempotens, és a következő futás pótolja a kimaradt törlést.

**Ellenőrzés:** devben `AUDIT_LOG_RETENTION_DAYS=0` mellett a task nem töröl. Egy kézzel visszadátumozott sor egy rövid szabállyal (`*/1 * * * *`) futtatott taskkal eltűnik.

- [ ] Human

### 7. Tesztek, e2e, dokumentáció

- [ ] Middleware unit teszt (`src/middlewares/audit-log.test.ts`) mockolt `strapi`-val és `ctx`-szel:
  - sikeres kérés,
  - dobott hiba (a hiba továbbdobódik, a sor mégis létrejön),
  - a sink DB-hibája (a kérés eredménye nem változik),
  - `AUDIT_LOG_ENABLED=false`,
  - `AUDIT_LOG_SINK=stdout` (nincs DB-hívás).
- [ ] A Playwright e2e (`e2e/`) zöld marad. Opcionális új teszt: egy backoffice mentés után az `/admin` API-n keresztül ellenőrizhető egy audit sor.
- [ ] `docs/deploy/cpanel/`: rövid szekció az `AUDIT_LOG_*` env-ekről és arról, hol olvasható a stdout (Passenger log).
- [ ] A plan `**Status:**` mezője frissül.

**Ellenőrzés:** a CI (`ci.yml`: prettier, tsc, `npm test`, build) zöld.

- [ ] Human

---

## 6. Adatvédelem és biztonság

- Az IP és az e-mail személyes adat. A retenció (`AUDIT_LOG_RETENTION_DAYS`) és a hozzáférés (csak admin RBAC) ezért kötelező beállítás.
- A redakciós lista bővíthető env-ből. Új, érzékeny mezőt tartalmazó endpoint bevezetésekor ezt a listát is át kell nézni.
- Az audit tábla nem kap Content API jogot. Írni csak a middleware ír, a Document Service megkerülésével.
- Az audit sorok az admin panelen elvileg szerkeszthetők és törölhetők. Ha a manipulációvédelem követelmény lesz, a V2-ben admin RBAC-cal csak olvasásra kell korlátozni, vagy DB-szinten append-only jogosultságot kell adni.

---

## V2 javaslat: Document Service audit (D opció)

**Status:** javaslat, nem része a v1-nek.

### Miért

A v1 azt mutatja, hogy **melyik endpointot** hívták és **mit küldtek**. Nem mutatja viszont:

- hogy egy hívás **mely dokumentumokat** érintette. A `POST /api/transaction-workflows/convert` egy hívással több tranzakciót hoz létre vagy stornóz, a `discardDraft` és a publish-guard pedig kapcsolt bizonylatot publikál.
- a rekord **előtte/utána** állapotát (diff).
- a nem HTTP-ből jövő írásokat (bootstrap seederek, cron, importok).

### Hogyan

- Egy `strapi.documents.use(...)` middleware a [`src/publish-guard.ts:527`](../../src/publish-guard.ts) mintájára, a `register()`-ben bekötve, a publish-guard **után**, hogy a végső adatot lássa.
- Elfogott műveletek: `create`, `update`, `delete`, `publish`, `unpublish`, `discardDraft`. Szűrés uid-listával (`AUDIT_DOC_UIDS`, alapból `api::*`), az `api::audit-log.audit-log` mindig kizárva.
- Az adatok:
  - az actor és a `requestId` a `strapi.requestContext.get()`-ből jön (`ctx.state.requestId`, amelyet a v1 middleware már beállít)
  - ha nincs request context, `actor_type=system`
  - `uid`, `documentId`, `action`, `locale`, `status`
  - opcionálisan `changes`: az `update` előtt egy `findOne` a régi állapotért, majd mezőszintű diff a `{ field: [old, new] }` formában, ugyanazzal a redakcióval
  - a diff env-flaggel kapcsolható (`AUDIT_DOC_DIFF=false` alapból), mert írásonként egy extra olvasásba kerül
- Tárolás: új `audit-change` content type (`audit_changes`), amelyet a `request_id` köt az `audit_logs` sorhoz. Így egy HTTP sorhoz N változás-sor tartozhat.
- Az írás itt is `strapi.db.query`-vel történik, nem a Document Service-szel, hogy ne legyen rekurzió.

### Kockázatok

- Bulk műveleteknél (seederek, import) sok sor keletkezik. Ezt az `AUDIT_DOC_UIDS` és egy `AUDIT_DOC_SKIP_SYSTEM=true` flag kezeli.
- A diff extra lekérdezést jelent. Ezért csak a kritikus uid-okra (`transaction`, `receipt`) érdemes bekapcsolni.
- A middleware-sorrend a publish-guarddal tesztet igényel: a publish-guard által beírt `entered_by` / `published_by` értékeknek látszaniuk kell.

### Ellenőrzés (V2)

- Egy `convert` hívás után az `audit_changes` táblában N sor jelenik meg ugyanazzal a `request_id`-vel, mint az `audit_logs` sor.
- Egy admin panelen végzett szerkesztés diffje helyes, és a jelszómezők redaktálva vannak.
