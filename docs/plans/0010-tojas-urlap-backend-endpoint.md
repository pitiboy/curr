# 0010 — Napi tojás űrlap: egy backend endpoint, workflow sablonokkal

**Állapot:** megvalósítva (PR). Kapcsolódó: [Ügyletek — Napi tojás](../transaction-workflow.md#napi-tojás-rögzítés-edizone-backoffice), [0002](./0002-transaction-workflow-content-type.md), [0003](./0003-transaction-workflow-backoffice.md).

## Probléma

A `/workflows/egg-production` űrlap (BulkQuantityEntryPage) a kliensen állította elő a lábakat (termelés, készlet átvezetés, továbbosztás), és soronként írta őket REST-en (create / update / publish?eggAuto=1). Részleges hiba esetén félkész esemény maradt az adatbázisban, a duplikátum ellenőrzés és az anchor (`related_transaction`) logika a böngészőben futott, és a lábak könyvelési szabályai kétszer léteztek (kliens + Convert sablon).

## Döntés

- Új endpoint: `POST /api/egg-production/entries` (`src/api/egg-production`, `src/egg-production/service.ts`), `?dryRun=1` előnézettel.
- A lábakat a transaction-workflow motor pure kifejtése (`expandWorkflowSteps`) adja virtuális forrás sorral: nincs storno, nincs `converted_to_workflow`, nincs `entered_key`. A Convert kódja nem változik.
- Három dedikált sablon (edizone seed 40–42): termelés + átvezetés (3 lépés), belső továbbosztás (1 lépés), eladás (3 lépés, az edizone 24-gyel egyező). **Draft** státusz és `0000` fejléc kód, így a Convert / katalógus nem látja őket. Seed idempotens (név + fejléc).
- A tagsági `mode` (internal / sale) a service-ben dől el; a megosztott tiszta logika (tagsági szabály, elosztási segédek) a backendbe költözött (`src/egg-production/`), a kliens csak megjelenítéshez importálja.
- Minden láb egy `strapi.db.transaction`-ben íródik; hiba → rollback. Auto-publish ugyanabban a tranzakcióban, a meglévő `eggAuto` (linked publish) szabályokkal.
- Duplikátum: dátum + szervezet + pénznem + T/K (mint eddig), szerver oldalon; `conflictChoice` `skip` / `replace` / `add` (+ ólankénti felülírás). Választás nélkül 409 + ütközés lista. Azonos kulcsú lábak (pl. két ól központi átvezetése) nem írhatják felül ugyanazt a meglévő sort.
- Jogosultság szerver oldalon: `egg-production` feature flag, szerep (dataentry / editor / controller vagy a Settings `config.roles`), szervezeti hatókör (dataentry / editor csak saját szervezet, minden láb szervezetére; controller bármire).

## Nem cél

- Nincs 1/3-os részesedés könyvelés.
- A `database/seeders/egg-sheet-to-transactions.mjs` (Excel import) nem változik; egyszeri, elavult.
- KOR pénztár (`1100`) soha nem szerepel (a terv 422-vel tiltja); a riportok valós idejűek és változatlanok.

## Ellenőrzőlista

- [x] Backend: plan + service + route + `createEntries` jogosultság a content szerepeknek.
- [x] Seed: 40–42 sablon, `11-transaction-workflows.http` draft támogatás.
- [x] Frontend: a varázsló egy POST-tal ment, 409 → ütközés párbeszéd (skip / replace / add), soronkénti eredmény / hiba.
- [x] Tesztek: backend (több ól, átvezetés, internal vs sale, anchor, rollback, duplikátum, org scope, flag off, auto-publish), frontend (egy kérés, eredmény megjelenítés, 409, hiba).
- [ ] Telepítés után: `npm run seed:http:edizone:transaction-workflows -- prod` (sablonok), majd egy próba mentés `?dryRun=1`-gyel.
