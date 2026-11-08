# Implementation plan: Tojás eladás — közvetítői jutalék

**Status:** proposed
**Date:** 2026-11-08
**Kapcsolódó:** [docs/transaction-workflow.md — Napi tojás továbbosztás](../transaction-workflow.md#napi-tojás-továbbosztás-edizone-backoffice-2-lépés), [bulk-quantity README](../../apps/content-backoffice/src/workflows/bulk-quantity/README.md)
**Érintett kód:** [`membershipRules.ts`](../../apps/content-backoffice/src/workflows/bulk-quantity/membershipRules.ts), [`distributionLogic.ts`](../../apps/content-backoffice/src/workflows/bulk-quantity/distributionLogic.ts), [`distributionPlans.ts`](../../apps/content-backoffice/src/workflows/bulk-quantity/distributionPlans.ts), [`loadDistribution.ts`](../../apps/content-backoffice/src/workflows/bulk-quantity/loadDistribution.ts), [`BulkQuantityEntryPage.tsx`](../../apps/content-backoffice/src/workflows/bulk-quantity/BulkQuantityEntryPage.tsx), [`types.ts`](../../apps/content-backoffice/src/workflows/bulk-quantity/types.ts), [`configs/eggDailyEntry.config.ts`](../../apps/content-backoffice/src/workflows/bulk-quantity/configs/eggDailyEntry.config.ts), [`parseBackofficeConfig.ts`](../../apps/content-backoffice/src/workflows/parseBackofficeConfig.ts)

Ezt a fájlt egy másik agent hajtja végre. A terv a **Napi tojás rögzítés** űrlap 2. lépését (továbbosztás) bővíti azzal, hogy külső eladásnál közvetítői jutalék sor keletkezik. A jutalék kedvezményezettjét a mentéskor megjelenő popupban kell kiválasztani.

---

## Hogyan kell végrehajtani

- Egyszerre egy számozott lépést kell elvégezni, a lépés végén lévő ellenőrzéssel.
- Egy lépés végén az agent kipipálja a saját négyzeteit, és **megáll** a Human sor előtt.
- Ha az ellenőrzés elbukik, a következő agent ugyanennek a lépésnek a javítását végzi, nem lép tovább.
- Új npm függőség nem kerül be. A popup a meglévő MUI `Dialog` mintát követi (lásd `GlobalConflictDialog` a `BulkQuantityEntryPage.tsx`-ben).
- Minden felhasználói szöveg i18n kulcson megy (`hu.ts` és `en.ts` együtt).

Helyben a Strapi a `http://localhost:1337` címen, az SPA a `http://localhost:5173/backoffice/` címen fut.

---

## 1. Háttér

A régi Excel ([`egg-sheet.csv`](../../database/seeders/fixtures/egg-sheet.csv)) az eladás sorában vezette a közreműködőt („Közrem.”) és a „10% közrem.díj”-at. Ez a díj csak **külső vevőnél** jelent meg, és a bruttó eladási ár 10%-a volt. Például 20 db × 100 Ft = 2000 Ft bruttó, ebből 200 Ft a jutalék. A közreműködő nem feltétlenül a begyűjtő: a 2026-03-14-i sorban a begyűjtő Dávid, a jutalékot mégis Peti kapta.

A mostani rendszerben sem a 23-as és 24-es ügyletsablon, sem a továbbosztás nem könyvel jutalékot.

## 2. Cél és nem-cél

### Cél

1. A tagsági szabály (`rules.egg`) két új, opcionális mezőt kap:
   - `commissionPercent`: a külső eladás jutalékszázaléka. A bruttó eladási árból számolódik.
   - `internalPercent`: a belső átvétel önköltség-aránya az EGG→HUF árfolyamhoz képest (pl. 60 → 100 Ft-os árfolyamon 60 Ft/db).
2. Ha a továbbosztásban egy `sale` módú tagnál a `commissionPercent` nagyobb nullánál, mentéskor megjelenik egy **popup**. Ebben soronként ki kell választani, ki kapja az adott napi eladás jutalékát. A jelöltek a Settingsben beállított tagságtípusok tagjai (alapból Bentlakó és Társult tag). Választható a „nincs közvetítő” is.
3. Az `Érdeklődő` tagságtípus `ratio` értéke mindenhol `0.75`-ről `1`-re változik (seed, fallback, `initial-data.js`, dokumentáció, meglévő adatbázis).
4. Minden kiválasztott kedvezményezetthez egy új tranzakció keletkezik:

| Lépés          | Tartozik ←                    | Követel                            | Összeg                   | Pénznem                    | Szervezet    | Típus     |
| -------------- | ----------------------------- | ---------------------------------- | ------------------------ | -------------------------- | ------------ | --------- |
| Közvetítői díj | `5600` Értékesítési költségek | kedvezményezett `1101` tagi számla | bruttó bevétel × % / 100 | eladási pénznem (alap HUF) | `Tyúktartás` | `Jutalék` |

A bevétel (`4000`) sora továbbra is a **bruttó** összeg, nem változik. A jutalék külön ráfordítás. A `1101` egyenlege mutatja, mennyivel tartozik a szövetkezet a kedvezményezettnek. Ez a dokumentált „tag által megelőlegezett költség” mintát követi (költség ← tag `1101`). A kifizetés (`1101` ← `1000`/`1100`) külön, kézi tranzakció, és nem része ennek a tervnek.

### Nem-cél

- **Az `internalPercent` semmilyen könyvelést nem indít.** Csak a típusba, a parse-ba és a seedbe kerül be, és a dokumentációban „fenntartott” jelzést kap. Indok: nincs kimutatás arról, hogy egy belső átvétel melyik tojásból történt. A mező majd egy utólagos elszámoló riportban kap szerepet.
- A 23-as és 24-es ügyletsablon (Convert) nem változik. A pénznem és az árfolyam kezelése külön PR-ben jön.
- A jutalék kifizetése nem része a tervnek.
- A Tojás készlet riport nem kap új oszlopot (opcionális, lásd a 6. lépést).

## 3. Fogalomtár

| Fogalom         | Jelentés                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Külső eladás    | Továbbosztási sor `sale` módú taggal, ahol a feloldott szabályban `commissionPercent > 0`. Tisztán konfiguráció-vezérelt: bármely tagságtípus vagy tagság lehet ilyen, ha be van állítva rajta a százalék |
| Bruttó bevétel  | `saleRevenueAmount(eggs, ratio, rate)`, ugyanaz az összeg, ami a `4000` soron áll                                                                                                                         |
| Jutalék         | `Math.round(bruttó × commissionPercent / 100)`, **egész forintra** kerekítve                                                                                                                              |
| Kedvezményezett | Jelölhető tag, akinek van `1101` tagi számlája, és a popupban őt választották ki                                                                                                                          |
| Jelölhető tag   | Olyan tag, akinek a dátumon érvényes tagságának típusa szerepel a `commissionBeneficiaryMembershipTypes` listában                                                                                         |

## 4. Konfiguráció

**Tagságtípus `rules.egg`** ([`membership-types.json`](../../database/seeders/http/edizone/data/membership-types.json) seed). A tagsági (`membership.rules`) szabály továbbra is felülírja a típus szabályát, mezőnként.

| Típus               | mode       | ratio | commissionPercent | internalPercent |
| ------------------- | ---------- | ----- | ----------------- | --------------- |
| Bentlakó tag        | `internal` | 1     | —                 | 60              |
| Társult tag         | `internal` | 1     | —                 | 60              |
| Partner / Bedolgozó | `sale`     | 1     | 10                | —               |
| Vásárló             | `sale`     | 1     | 10                | —               |
| Érdeklődő           | `sale`     | **1** | 10                | —               |

A jutalék csak attól függ, hogy a feloldott szabályban be van-e állítva a `commissionPercent`. A seed a fenti alapértékeket adja, ezek a Strapi adminban típusonként vagy tagságonként átállíthatók (pl. `0` → nincs jutalék).

Az `internalPercent` az EGG→eladási pénznem árfolyam **százaléka** (60 × 100 Ft / 100 = 60 Ft/db), így követi az árfolyamváltozást.

Ugyanezt kell frissíteni a kódbeli fallback táblában (`EGG_RULE_FALLBACK_BY_MEMBERSHIP_TYPE_NAME`) és a [`initial-data.js`](../../database/seeders/initial-data.js)-ben is. A `Pártoló tag` a seed JSON-ban nincs, csak ezekben. Ez is `sale`, `ratio: 1`, `commissionPercent: 10`.

**Settings `egg-production.config`** ([`backoffice-features.json`](../../database/seeders/http/edizone/data/backoffice-features.json)), új kulcs:

| Kulcs                                  | Alapérték                         | Jelentés                                                          |
| -------------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `commissionBeneficiaryMembershipTypes` | `["Bentlakó tag", "Társult tag"]` | A popupban felajánlott tagok tagságtípusai (bármely szervezetben) |

Ha a kulcs hiányzik vagy üres, a kód az alapértéket használja.

---

## 5. Lépések

### 1. Szabály-típus és parse

- [ ] `membershipRules.ts`: az `EggDistributionRule` bővül: `commissionPercent: number` (alap 0), `internalPercent: number | null` (alap `null`). A `parseEggRuleFragment` mindkettőt validálja: véges szám, 0 és 100 között. Érvénytelen érték esetén a mezőnek az alapérték kell, ne az egész szabály legyen `null`.
- [ ] `resolveEggRule`: a membership-szintű felülírás **mezőnként** érvényesüljön. Ha a membership csak `commissionPercent`-et ad meg, a `mode`/`ratio` a típusból jöjjön. Ha ez a meglévő viselkedést megtörné (most a fragmentnek `mode` kell), a változást dokumentálni kell a README-ben.
- [ ] Fallback tábla frissítése a 4. fejezet szerint, az `Érdeklődő` `ratio` értéke `1`.
- [ ] Teszt: új `membershipRules.test.ts`. Esetek: hiányzó mezők → alapértékek; `commissionPercent: 150` → 0; membership felülírja csak a százalékot; `internalPercent` beolvasása; `Érdeklődő` fallback → `ratio: 1`, `commissionPercent: 10`.
- [ ] Ellenőrzés: `npx nx test content-backoffice` (vagy a repo szokásos vitest parancsa) zöld.
- [ ] Human

### 2. Jutalék leg a tiszta logikában

- [ ] `distributionLogic.ts`: új `saleCommissionAmount(revenue, percent)`: `Math.round(revenue * percent / 100)`, egész forint. A bevétel kerekítése (`saleRevenueAmount`, 2 tizedes) nem változik.
- [ ] `DistributionMemberRow` új mezője: `commissionBeneficiary?: { memberId: string; memberName: string; accountId: string } | null`.
- [ ] `buildDistributionLegs` új bemenetei: `commissionExpenseAccountId`, `commissionTransactionTypeId`. Ha egy `sale` sornál `eggRule.commissionPercent > 0`, van `commissionBeneficiary`, és a jutalék nagyobb nullánál, akkor a `:revenue` leg után jön egy negyedik leg is:
  - `legKey: ${row.memberId}:commission`
  - `debitAccountId: commissionExpenseAccountId` (`5600`), `creditAccountId: beneficiary.accountId` (`1101`)
  - `currencyTypeId: saleCurrencyTypeId`, `organizationId: bookingOrganizationId`, `transactionTypeId: commissionTransactionTypeId`
  - `descriptionKey: 'app.bulk_quantity.description.egg_distribution_commission'`, paraméterek: `member` (vevő), `beneficiary`, `revenue`, `percent`, `commission`
- [ ] Új helper: `rowsNeedingCommission(rows): DistributionMemberRow[]`. Azokat a `sale` sorokat adja vissza, ahol `amount > 0` és `commissionPercent > 0`.
- [ ] `distributionLogic.test.ts` bővítése: 20 db × 100 Ft × 10% → 200; 7 db × 100 Ft × 10% → 70; kerekítés: 3 db × 55 Ft × 10% (16,5) → 17; nincs kedvezményezett → nincs leg; `internal` sor → nincs leg; a `commissionPercent: 0` → nincs leg; a legek sorrendje egg, cash, revenue, commission.
- [ ] Ellenőrzés: a unit tesztek zöldek.
- [ ] Human

### 3. Config, refs és a kedvezményezettek betöltése

- [ ] `eggDailyEntry.constants.ts`: `DISTRIBUTION_COMMISSION_EXPENSE_ACCOUNT_CODE = '5600'`. A `1101` a `memberAccounts.ts` `MEMBER_TAG_ACCOUNT_CODE` konstansát használja.
- [ ] `types.ts` → `BulkQuantityDistributionConfig`: `commissionExpenseAccountCode`, `commissionBeneficiaryAccountCode`, `commissionTransactionTypeName`. `DistributionResolvedRefs`: `commissionExpenseAccountId`, `commissionTransactionTypeId`.
- [ ] `configs/eggDailyEntry.config.ts`: értékek: `'5600'`, `'1101'`, `'Jutalék'`.
- [ ] `loadDistributionRefs`: a két új ref feloldása. Ha egyik sem található, az **nem** teheti tönkre a meglévő továbbosztást. Ilyenkor a refs `commission*` mezői `null`-ok, és a popup letiltott állapotot mutat egy hibaüzenettel (lásd a 4. lépést).
- [ ] `loadDistribution.ts`: új `loadCommissionBeneficiaries(httpClient, strapiUrl, membershipTypeNames, isoDate)`. Lekéri a `memberships` sorokat `membership_type.name $in` szűrővel (szervezettől függetlenül), a `members.account` populate-tal. Ezután szűr a `membershipValidOnDate`-re, deduplikál `memberId` szerint, és kihagyja azokat, akiknek nincs `1101` számlája. A lista név szerint rendeződik (`localeCompare(..., 'hu')`).
- [ ] `parseBackofficeConfig.ts`: `commissionBeneficiaryMembershipTypesForWorkflow(config, 'egg-production')`, az `eggSaleCurrencyForWorkflow` mintájára, alapértékkel. Teszt a `workflows.test.ts`-ben.
- [ ] Ellenőrzés: unit tesztek zöldek, `npx tsc --noEmit` a backoffice appra hibátlan.
- [ ] Human

### 3b. Seed, `Érdeklődő` ratio és migráció

- [ ] Seed a 4. fejezet szerint:
  - [`edizone/data/membership-types.json`](../../database/seeders/http/edizone/data/membership-types.json): új mezők, `Érdeklődő` `ratio: 1`.
  - [`kor/data/membership-types.json`](../../database/seeders/http/kor/data/membership-types.json): ugyanez. A kor példányon az `egg-production` ki van kapcsolva, de a szabályok legyenek azonosak.
  - [`initial-data.js`](../../database/seeders/initial-data.js): ugyanez, a `Pártoló tag` is.
  - [`edizone/data/backoffice-features.json`](../../database/seeders/http/edizone/data/backoffice-features.json): `egg-production.config.commissionBeneficiaryMembershipTypes`.
- [ ] A `0.75` dokumentációs említéseinek javítása: [`docs/transaction-workflow.md`](../transaction-workflow.md) („pl. Érdeklődő 0.75”) és [`docs/plans/0002-transaction-workflow-content-type.md`](./0002-transaction-workflow-content-type.md). A példa legyen általános („eltérő ratio-jú tagság”), ne konkrét típus. Ellenőrzés: `grep -rn "0\.75"` a `database/`, `src/`, `apps/content-backoffice/src/` és `docs/` alatt nem ad ratio-találatot (ez a plan fájl kivétel).
- [ ] Új migráció: `database/migrations/2026.11.08T00.00.00.000.egg-commission-rules.js`, a meglévő `rename-egg-daily-entry-to-egg-production.js` mintájára. Idempotens, és ha nincs tábla vagy oszlop, nem csinál semmit.
  - A `membership_types` táblában a `rules.egg` JSON-t mezőnként egészíti ki a 4. fejezet táblája szerint, név alapján. Csak a **hiányzó** kulcsot írja, a kézzel beállított értéket nem írja felül.
  - Kivétel az `Érdeklődő` `ratio`: ha az értéke `0.75`, `1` lesz. Más értékhez nem nyúl.
  - A `backoffice_features` `egg-production` sorának `config`-jába beírja a `commissionBeneficiaryMembershipTypes` kulcsot, ha hiányzik.
  - A JSON oszlop lehet string vagy objektum (SQLite/Postgres), ezt mindkét irányban kezelni kell.
- [ ] Ellenőrzés: a migráció kétszer futtatva ugyanazt az állapotot adja. Helyi adatbázison a Strapi admin a frissített szabályokat mutatja.
- [ ] Human

### 4. Popup a továbbosztás mentésekor

- [ ] Új komponens: `CommissionBeneficiaryDialog.tsx` a `bulk-quantity` mappában.
  - Bemenet: a `rowsNeedingCommission` sorai (vevő neve, db, bruttó, %, jutalék), a kedvezményezettek listája, és az alapértelmezett választás.
  - Soronként egy `Select`. Az opciók a kedvezményezettek, plusz a „Nincs közvetítő (nincs jutalék)”. Kezdetben nincs kiválasztva semmi, hacsak nincs megjegyzett alapérték.
  - Felül egy „Mindegyik sorra” gyorsválasztó, ami minden sort beállít.
  - A Mentés gomb csak akkor aktív, ha minden sorban van választás. Mégse esetén nem történik mentés, és az űrlap állapota megmarad.
  - Ha a commission refek hiányoznak, vagy a kedvezményezett-lista üres: figyelmeztetés jelenik meg. Ilyenkor csak a „Nincs közvetítő” választható, így a mentés nem blokkolódik.
- [ ] Az utolsó választás a `localStorage`-ba kerül (`egg-production.lastCommissionBeneficiary`). Minden olvasás és írás `try/catch`-ben van, és a dialógus nélküle is működik.
- [ ] `BulkQuantityEntryPage.tsx`:
  - A `handleSaveAll` a validáció után, de még a `prepareSave` **előtt** kiszámolja a `rowsNeedingCommission`-t. Ha nem üres, megnyitja a popupot, és a mentés a popup megerősítése után folytatódik.
  - A kiválasztott kedvezményezettek egy `Record<buyerMemberId, beneficiary | null>` állapotba kerülnek. A `buildLegPayloads` innen tölti a `DistributionMemberRow.commissionBeneficiary` mezőt. A `confirmGlobalConflicts` és a `confirmConflicts` útvonal ugyanezt az állapotot használja, így a duplikátum-párbeszéd után sem vész el a választás.
  - A „Csak termelés mentése” gomb nem nyitja meg a popupot.
  - A kedvezményezettek a `refreshDistributionContext`-ben, a tagokkal együtt töltődnek, a form dátumára.
- [ ] A 2. lépés tagsoraiban a `sale` sor mellett egy rövid infó jelenik meg: „+10% közvetítői díj”, ha a szabályban van százalék.
- [ ] i18n (`hu.ts`, `en.ts`): a dialógus címe, a mezőcímkék, a „Nincs közvetítő”, a „Mindegyik sorra”, a hibaüzenetek, a tagsoron megjelenő infó, valamint a `description.egg_distribution_commission`. Magyar példa: `'Tojás eladás közvetítői díj — %{member} vevő, %{beneficiary}: %{percent}% × %{revenue} Ft = %{commission} Ft'`.
- [ ] Ellenőrzés: kézi próba helyben. Egy Vásárló tagnak 20 db, mentés, a popupban Peti kiválasztása. Az eredmény 4 továbbosztási leg, ebből a negyedik `5600` ← Peti `1101`, 200 Ft (100 Ft/db árfolyamon), `Jutalék` típus, `related_transaction` a termelésre.
- [ ] Human

### 5. Duplikátum-kezelés

- [ ] Meg kell nézni, hogy a `collectDuplicates` és a `legPlansWithGlobalChoice` a jutalék leget is kezeli-e. A kulcs a dátum, a szervezet, a pénznem és a tartozik/követel számlapár. A `1101` kedvezményezettenként más, ezért ugyanannak a napnak egy másik kedvezményezettje új sor lesz, nem frissítés. Ez a kívánt viselkedés.
- [ ] Ha ugyanaz a kedvezményezett két vevő után is jutalékot kap ugyanazon a napon, a két leg ugyanarra a számlapárra esik. Ellenőrizni kell, hogy az „update” választás nem írja-e felül egyik a másikat. Ha igen, a duplikátum-keresésnek a `legKey`-t (vevő + `:commission`) is figyelembe kell vennie, vagy a jutalék leget mindig `insert`-ként kell kezelni. Bármelyik megoldás jó, de dokumentálni és tesztelni kell.
- [ ] Teszt a `duplicateFetch.test.ts`-ben vagy a `distributionLogic.test.ts`-ben a fenti két esetre.
- [ ] Human

### 6. Dokumentáció, e2e, opcionális riport

- [ ] [`docs/transaction-workflow.md`](../transaction-workflow.md) — „Napi tojás továbbosztás” szakasz:
  - A szabály-JSON példa bővítése a `commissionPercent` és az `internalPercent` mezővel. Az `internalPercent` „fenntartott, jelenleg nem könyvel” jelzést kap.
  - A könyvelési táblázat új sora: `sale` — közvetítői díj.
  - A mermaid diagram új ága: `Ert5600->>Tag1101: jutalék HUF`.
  - A popup leírása.
- [ ] [`bulk-quantity/README.md`](../../apps/content-backoffice/src/workflows/bulk-quantity/README.md): a negyedik `sale` leg leírása.
- [ ] e2e: ha a `e2e/backoffice-smoke.spec.ts` lefedi a tojás továbbosztást, egy Vásárló sorral és a popup kitöltésével kell bővíteni. Ha nem fedi le, ez a lépés csak jegyzet a plan végén.
- [ ] Opcionális: a Tojás készlet riport ([`eggInventory.aggregate.ts`](../../apps/content-backoffice/src/pages/reports/eggInventory/eggInventory.aggregate.ts)) „Jutalék” oszlopot kaphat (`5600` ← `1101`, eladási pénznem). A meglévő `isSaleCashLeg` ezt a leget nem számolja bele, ezt egy teszt rögzítse.
- [ ] A plan `**Status:**` mezője frissül.
- [ ] Human

### 7. (Opcionális) Excel-import igazítása

- [ ] [`egg-sheet-to-transactions.mjs`](../../database/seeders/egg-sheet-to-transactions.mjs): a `sale:commission` sor jelenleg `közrem 1001 ← 4000`. Ez legyen `5600` ← közrem `1101`, `Jutalék` típussal.
- [ ] A `sale:revenue` összege legyen a bruttó (`Db × Ár/db`), ne a nettó „Ft bevétel”. Ha a két oszlop és a jutalék összege nem egyezik, figyelmeztetés kell.
- [ ] A `egg-sheet-to-transactions.test.mjs` frissítése, majd a `transactions.json` újragenerálása.
- [ ] Human

---

## 6. Döntések (2026-11-08)

1. **Jelölhető kedvezményezettek:** a `Bentlakó tag` és a `Társult tag`. Az alapérték `["Bentlakó tag", "Társult tag"]`, a Settingsben módosítható.
2. **Ki számít külső eladásnak:** bárki, akinek a feloldott szabályában be van állítva a `commissionPercent`. A seed minden `sale` típusra 10-et ad, a Partner / Bedolgozóra is.
3. **Kerekítés:** a jutalék egész forintra kerekül (`Math.round`).
4. **Árszint:** az `Érdeklődő` `ratio` értéke mindenhol `1` (lásd a 3b. lépést).
5. **`internalPercent`:** az árfolyam százaléka. Jelenleg nem könyvel.
