# Implementation plan: Eszköznyilvántartás (tárgyi eszközök)

**Status:** implemented (Human ellenőrzésre vár)  
**Date:** 2026-11-15  
**Kapcsolódó:** [Ügyletek](../transaction-workflow.md), [0002 transaction-workflow](./0002-transaction-workflow-content-type.md), [0003 workflow backoffice](./0003-transaction-workflow-backoffice.md), [0004 audit log](./0004-audit-log.md), [0008 globális sidebar szűrők](./0008-global-sidebar-filters.md)  
**Érintett kód:** [`src/api/asset/`](../../src/api/asset/), [`src/api/asset-category/`](../../src/api/asset-category/), [`src/assets/`](../../src/assets/), [`src/org-scope-middleware.ts`](../../src/org-scope-middleware.ts), [`src/content-roles.ts`](../../src/content-roles.ts), [`apps/content-backoffice/src/pages/assets/`](../../apps/content-backoffice/src/pages/assets/), [`apps/content-backoffice/src/pages/reports/assetReconciliation/`](../../apps/content-backoffice/src/pages/reports/assetReconciliation/)

Egyedi tárgyak (gépek, szerszámok, járművek …) nyilvántartása szervezetenként. A könyv szerinti érték továbbra is az `1500 – Tárgyi eszközök` számlán van (tranzakciókból számolva); az eszköz rekord a fizikai tárgyat írja le, és opcionálisan a beszerzési / selejtezési tranzakcióra mutat. Mozgás- / előzménymodell nincs: a változásokat a meglévő audit log rögzíti.

Munkarend (mint a 0001-nél): az agent kipipálja a saját négyzeteit, a **Human** sorokat nem; a Human végigpróbálja a leírt utat, és ő pipál.

---

## 1. Döntések

| Kérdés                         | Döntés                                                                                                                                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hol él a `collect_asset` flag? | Saját boolean mező a `transaction-workflow` sémán (default `false`), nem a fenntartott `configuration` JSON-ban: a Strapi Adminban kapcsolóként látszik, típusos, és a katalógus (`fetchPublishedWorkflows`) mezőként kapja.                                                           |
| Könyvelés = ?                  | A **Mentés és kifejtés** (create űrlap) és a **Kifejtés** gomb (meglévő sor) sikeres Convertje. Sima piszkozat mentés (dataentry) nem nyit eszköz űrlapot.                                                                                                                             |
| Melyik tranzakcióra mutasson?  | A Convert által létrehozott első, `1500`-at terhelő lábra; ha nincs ilyen, az eredetire. Az egyeztetés az eredetire mutató eszközt is elfogadja a láb párjaként (`related_transaction`).                                                                                               |
| Vásárlás ügylet követel oldala | Fejléc `1500` / `1100` (bank, a tényleges fizető), lépések a `2000` szállítón át: `1500 ← 2000` (számla), `2000 ← 1100` (utalás) — mint a „Csibe vásárlás tagi saját számláról”. A meglévő „Közös eszköz felújítás” `1500/2000` fejlécével így nincs kétértelmű match.                 |
| KOR kincstár kizárás           | Ideiglenesen konstansban (`KOR_TREASURY_ACCOUNT_CODE = '1100'`, `KOR_TREASURY_CURRENCY_CODE = 'KOR'`): a KOR pénznemű, 1100-at érintő sor kimarad. A HUF-os 1100 mozgás (pl. szállító kifizetése) marad.                                                                               |
| Egyeztetés szűrői              | A globális sidebar szűrőkből: státusz, ügylet bontás, szervezet, pénznem; a dátumtartomány **vége** az egyenleg napja (egyenleg = minden tétel addig). A tartomány eleje nem szűr.                                                                                                     |
| Hozzáférés                     | `asset` org-scoped (saját `organization` mező, kötelező); editor / dataentry csak a saját szervezetét olvassa / írja, a hivatkozott tranzakció is a saját szervezetéből lehet; törlés csak controller. `asset-category` globális lookup: mindenki olvassa, írni csak a controller tud. |
| Kategóriák seedje              | Bootstrap (`ensureAssetCategories`, idempotens) + httpyac `12-asset-categories.http` ugyanazzal a listával (`kor` / `edizone` data).                                                                                                                                                   |

## 2. Backend

- [x] **Agent:** `asset-category` content type (`name` kötelező + egyedi, `description`, `sort_order`), core router / controller / service.
- [x] **Agent:** `asset` content type (név, kategória, tulajdon típus enum default `coop_owned`, beszerzési ár + pénznem + dátum, helyszín, felelős tag, állapot enum, garancia, gyári szám, megjegyzés, fotó, szervezet kötelező, beszerzési / selejtezési tranzakció).
- [x] **Agent:** Org-scope middleware: `api::asset.asset` az `ORG_SCOPED_DOCUMENT_UIDS`-ban; update-nél szervezetváltás és a beszerzési / selejtezési tranzakció szervezete is ellenőrizve.
- [x] **Agent:** `registerAssetGuard` (enum, nem negatív ár, kötelező szervezet create-nél, szervezet nem törölhető).
- [x] **Agent:** Content role jogok: asset find / findOne / create / update minden content role-nak, asset delete és kategória írás csak controllernek.
- [x] **Agent:** `ensureAssetCategories` a bootstrapben; httpyac `12-asset-categories.http`; `asset-categories.json` (kor, edizone).
- [x] **Agent:** Audit: a `/api/assets*` és `/api/asset-categories*` írások a meglévő path-alapú audit middleware-en mennek át (teszt).
- [x] **Agent:** `transaction-workflow.collect_asset` (boolean, default `false`); a seeder átadja; „Tárgyi eszköz vásárlás” workflow (`41-targyi-eszkoz-vasarlas.json`, kor + edizone).
- [x] **Agent:** `assets` backoffice feature seed (kor, edizone: enabled).
- [x] **Agent:** Tesztek: org-scope (editor / dataentry saját org, controller minden), jogok, kategória seed idempotencia, séma enumok, guard.
- [ ] **Human:** `npm run develop` → a log 12× „Created asset category …”, második indításkor egyszer sem. Strapi Admin → Transaction-workflow: a „Collect asset” kapcsoló látszik.
- [ ] **Human:** `npm run seed:http:kor:local` (vagy edizone) → a „Tárgyi eszköz vásárlás” workflow és az `assets` Settings sor létrejön; ismételt futtatás nem duplikál.

## 3. Backoffice

- [x] **Agent:** „Eszközök” menü (feature `assets`, content role), „Eszköz kategóriák” menü (controller).
- [x] **Agent:** „Eszköznyilvántartás” lista: keresés (név, gyári szám, helyszín, megjegyzés), rendezhető oszlopok, szűrők (kategória, tulajdon típus, állapot, szervezet), fotó bélyegkép.
- [x] **Agent:** „Új eszköz” / „Eszköz szerkesztése” közös űrlap, tranzakció választó (üres keresés: legutóbbi 1500 terhelések / jóváírások), fotó feltöltés.
- [x] **Agent:** Eszköz adatlap: fotó, adatok, link a beszerzési / selejtezési tranzakcióra.
- [x] **Agent:** Workflow → „Új eszköz”: `collect_asset` workflow könyvelése után előtöltött űrlap (`?source=`: ár, pénznem, dátum, szervezet, név a leírásból, beszerzési tranzakció).
- [x] **Agent:** Konzisztencia jelentés: „Tárgyi eszközök (1500) egyeztetés” szekció pénznemenként, eltérés, hiányzó link listák; globális szűrők + Frissítés gomb, mint a többi report.
- [x] **Agent:** Vitest: aggregáció, szűrő-leképezés, workflow redirect + prefill, lista keresés / rendezés / szűrés, tranzakció választó.
- [ ] **Human:** controller → Eszközök → Új: eszköz mentése fotóval (Cloudinary-s környezetben), lista szűrők / keresés / rendezés, adatlap tranzakció linkje.
- [ ] **Human:** editor (egy szervezet) → csak a saját szervezet eszközei látszanak; más szervezet eszközének URL-je nem nyílik meg; törlés gomb nincs.
- [ ] **Human:** editor → Új tranzakció → „Tárgyi eszköz vásárlás” ügylet → Mentés és kifejtés → az „Új eszköz” űrlap nyílik előtöltve; mentés után a Konzisztencia jelentés 1500 szekciója egyezik.
- [ ] **Human:** Konzisztencia jelentés: a bal oldali szervezet / pénznem / időszak szűrő azonnal átszámolja az 1500 szekciót.

## 4. Nyitott / később

- A KOR kincstár szabály (1100 + KOR) és a 1500 számlakód Settings sorba költöztetése.
- `keep_original: false` workflow esetén az eredeti törlődik; az eszköz ekkor a Convert által létrehozott 1500-as lábra mutat (ha van ilyen), egyébként a link elveszhet.
- Értékcsökkenés, selejtezési ügylet sablon (1500 jóváírás) — külön terv.
