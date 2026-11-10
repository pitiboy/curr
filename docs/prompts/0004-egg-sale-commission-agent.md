# Agent prompt: Tojás eladás — közvetítői jutalék (plan 0005 végrehajtása)

Másold be az agentnek a **Feladat** szekciótól a végéig, vagy add át az egész fájlt. A **Végrehajtási mód** szekcióban válaszd ki, hogy az agent egyben vagy lépésenként dolgozzon.

## Feladat

Hajtsd végre a [`docs/plans/0005-tojas-eladas-kozvetitoi-jutalek.md`](../plans/0005-tojas-eladas-kozvetitoi-jutalek.md) implementációs tervet. A terv az egyetlen forrás arra, hogy mit kell csinálni. Ez a prompt csak a munkarendet, a korlátokat és a kész-kritériumot adja meg. Ha a prompt és a terv ellentmond egymásnak, a terv az irányadó, és az ellentmondást jelezd az összefoglalóban.

Röviden a cél: a **Napi tojás rögzítés** űrlap 2. lépésében (továbbosztás) a külső eladás (`sale` mód, `commissionPercent > 0`) után mentéskor egy popup kérdezze meg, ki kapja a jutalékot. A kiválasztott kedvezményezetthez keletkezzen egy `5600` ← `1101` HUF `Jutalék` sor, egész forintra kerekítve. Emellett az `Érdeklődő` ratio mindenhol `1` lesz, és egy migráció frissíti a meglévő adatbázist.

**Hatókör:** a terv 1., 2., 3., 3b., 4., 5. és 6. lépése. A 7. lépés (Excel-import) **nem** része a feladatnak, csak akkor, ha külön kérem.

## Végrehajtási mód

Válassz egyet (a felhasználó törli a másikat):

- **A) Folyamatos (alap):** a lépéseket sorrendben, megállás nélkül végzed. A terv „megáll a Human sor előtt” szabályát ebben a módban felülírom: a Human négyzeteket **ne** pipáld ki, azok a végső review-hoz maradnak. Ha egy lépés ellenőrzése elbukik, ne lépj tovább, hanem javítsd. Ha nem sikerül, állj meg, és jelezd.
- **B) Lépésenkénti:** a terv „Hogyan kell végrehajtani” szabályai szerint egyszerre egy lépést végzel, és a Human sor előtt megállsz.

## Kontextus

- Monorepo. Strapi 5 backend a repo gyökerében (`src/`, `database/`), React Admin SPA az `apps/content-backoffice` alatt.
- Az érintett modul az [`apps/content-backoffice/src/workflows/bulk-quantity/`](../../apps/content-backoffice/src/workflows/bulk-quantity/). Előbb olvasd el a README-jét és a terv „Érintett kód” listáját.
- A könyvelési szabályok a [`docs/transaction-workflow.md`](../transaction-workflow.md) „Napi tojás rögzítés” és „Napi tojás továbbosztás” szakaszában vannak.
- A seed adatok: `database/seeders/http/{edizone,kor}/data/`. A migrációk: `database/migrations/` (minta: `2026.11.06T00.00.00.000.rename-egg-daily-entry-to-egg-production.js`).
- A tranzakciótípus (`Jutalék`) és a számlák (`5600`, tagi `1101`) már léteznek a seedben. Újat nem kell felvenni.

## Szabályok

1. **Branch:** `feat/egg-sale-commission`, a `main`-ből. Ne force-pusholj, és ne commitolj secretet (`.env*`, tokenek, `http-client.private.env.json`).
2. **Commit:** lépésenként egy commit, conventional formában (pl. `feat(egg): commission leg in distribution logic`). Push és PR csak akkor, ha a felhasználó kéri.
3. **Nincs új npm függőség.** A popup a meglévő MUI `Dialog` mintát követi (`GlobalConflictDialog` a `BulkQuantityEntryPage.tsx`-ben).
4. **A meglévő viselkedés nem változhat:**
   - jutalék nélküli `sale` sor: ugyanaz a 3 leg, mint eddig;
   - `internal` sor, „Csak termelés mentése”, pool-átvezetés: változatlan.

   Ezt tesztek rögzítsék.

5. **Az `internalPercent` csak adat.** Típus, parse, seed és dokumentáció, könyvelés nincs.
6. **A 23-as és 24-es ügyletsablonhoz és a Convert motorhoz (`src/transaction-workflow/`) ne nyúlj.** A pénznem- és árfolyamkezelés külön PR.
7. **i18n:** minden új szöveg a `hu.ts`-be és az `en.ts`-be is bekerül.
8. **A `localStorage`** csak az utolsó kedvezményezett megjegyzésére való, `try/catch`-ben, és nélküle is működnie kell.
9. **A migráció idempotens.** A kézzel beállított szabályértékeket nem írja felül, és SQLite-on és Postgresen is működik (a JSON oszlop lehet string vagy objektum).
10. **A tervtől eltérés:** ha a kód nem úgy működik, ahogy a terv feltételezi (pl. a duplikátum-kulcs vagy a `resolveEggRule` felülírási logikája), válaszd a legkisebb biztonságos megoldást. Ezt írd be a terv érintett lépéséhez egy „Megjegyzés (végrehajtás):” sorral, és említsd meg az összefoglalóban is.

## Ellenőrző parancsok

Minden lépés végén futtasd azokat, amelyek a változtatásokat lefedik:

```bash
npm run test --prefix apps/content-backoffice     # vitest
npm run lint --prefix apps/content-backoffice     # oxlint
npx nx run content-backoffice:build               # tsc -b + vite build
npm test                                          # Strapi oldali node tesztek
npm run test:seeders                              # seeder tesztek
npm run format:check
```

Ha a Strapi és az SPA helyben elindítható (`npm run dev:all`, edizone seed), a 4. lépés kézi próbáját is végezd el:

- Egy Vásárló tagnak 20 db tojás, mentés, a popupban egy Bentlakó vagy Társult tag kiválasztása.
- Az eredmény: 4 továbbosztási sor, a negyedik `5600` ← kedvezményezett `1101`, 200 Ft (100 Ft/db árfolyamon), `Jutalék` típus.

Ha a stack nem áll fel, ezt írd le blokkolóként. Ne színleld, hogy lefutott.

A Playwright e2e (`npm run test:e2e`) csak akkor kell, ha a meglévő specek lefedik a tojás űrlapot. Lásd a terv 6. lépését.

## Definition of Done

- [ ] A terv 1–6. lépésének (a 3b-vel együtt) minden agent-négyzete kipipálva. A Human sorok pipálatlanok.
- [ ] Új és bővített unit tesztek: szabály-parse, jutalék leg (200 Ft, 70 Ft, 16,5 → 17 kerekítés), nincs leg kedvezményezett nélkül, változatlan régi legek, duplikátum-esetek.
- [ ] Minden fenti ellenőrző parancs zöld, vagy a bukás oka dokumentált és nem ennek a változtatásnak a hibája.
- [ ] `grep -rn "0\.75"` a `database/`, `src/`, `apps/content-backoffice/src/` és `docs/` alatt nem ad ratio-találatot (kivéve a 0005-ös tervet).
- [ ] A migráció kétszer futtatva ugyanazt az állapotot adja.
- [ ] Frissült a dokumentáció: [`docs/transaction-workflow.md`](../transaction-workflow.md) és [`bulk-quantity/README.md`](../../apps/content-backoffice/src/workflows/bulk-quantity/README.md).
- [ ] A terv `**Status:**` mezője `implemented (review pending)`.

## Összefoglaló a végén

Adj rövid listát a következőkről:

1. Commitok (hash + üzenet), lépésenként.
2. Új és módosított fájlok.
3. A futtatott parancsok és az eredményük (pass/fail/skip, darabszámokkal).
4. Lefutott-e a kézi próba, és ha nem, mi volt a blokkoló.
5. Eltérések a tervtől, és a duplikátum-kezelésnél hozott döntés.
6. Ami a Human review-nál különösen nézendő (pl. a popup UX, a migráció éles adaton).
