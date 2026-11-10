# PRD 0002: Content Backoffice v2 (roadmap)

**Status:** draft — a kód alapján felülvizsgálva 2026-11-03-án; a nyitott tételekhez backlog item készült  
**Date:** 2026-10-12, kiegészítve 2026-10-15, felülvizsgálva 2026-11-03  
**Backlog:** [CURR - KÖR project](https://github.com/users/pitiboy/projects/2) (draft itemek, Status: Backlog)  
**Product:** `content-backoffice`  
**Depends on:** [0001-content-backoffice-v1](./0001-content-backoffice-v1.md)  
**Related ADR:** [0001-react-admin-content-ui](../adr/0001-react-admin-content-ui.md)  
**Domain:** [docs/readme.md](../readme.md)

## 1. Cél

Ez a dokumentum a v1-ből **szándékosan kihagyott** funkciókat gyűjti össze, és a későbbi üzemeltetés meg a teljesítmény megfontolásait. Nem szállítható sprint-scope; prioritás és szeletelés a v1 élesítése után történik.

**Állapot (2026-11-03):** a dokumentum csak a még nyitott, illetve részben kész tételeket tartalmazza. Ami már megvalósult (számla-allowlist config, CI és deploy pipeline, pre-commit kapu, séma és jog kódból), a [§9 Implementálva](#9-implementálva-2026-11-03) szakaszban van, fájlhivatkozásokkal. A részben kész tételeknél a „Még hiányzik” rész mondja meg, mi nyitott. A [§10](#10-backlog-itemek) a hozzájuk tartozó backlog itemek listája.

A menükatalógus előtt a könyvelési kör és a futási alap kerül sorra. A kompetenciák, a telephely, a feladatkezelés és a munkaidő a [domain-leírás](../readme.md#missing-items-to-consider-for-further-addition) későbbi tételei, nem ennek a PRD-nek a scope-ja.

## 2. Access és multi-tenancy

### 2.1 Org–user összerendelés (fa alapú ACL)

- Az `organization` fa struktúra. v2: org ↔ Content user összerendelések.
- Az SPA csak az összerendelt org(ok) (és opcionálisan leszármazottak) adatait mutatja / engedi módosítani.
- Egy user több szervezetet kezelhet, de a láthatóság kötött.
- Backend: query filter + policy (ne csak kliens oldali szűrés).

### 2.2 user ↔ member kapcsolat (opcionális)

- A `member` rekordok tényleges tagok; nem minden tag rendelkezik belépéssel.
- v2: opcionális kapcsolat Content user és `member` között (pl. későbbi személyes nézetekhez).
- Nem helyettesíti az org–user ACL-t; kiegészítő identity bridge.

## 3. Termékfelület bővítés

### 3.1 Teljes menükatalógus

Az ADR szerinti resourceok SPA menüben (schema-driven list/edit ahol elég):

- Organizations
- Members
- Memberships
- Accounts
- Currencies (currency-type / rate / category ahogy indokolt)
- Receipts mint **önálló** resource (nem csak a tranzakció űrlap része)

### 3.2 Profil avatar

- Avatar feltöltés / megjelenítés a profil oldalon (v1: csak név, email, jelszócsere).
- **Még hiányzik:** az app bar user menüje már tud avatart rajzolni (`UserAvatar`, [`BackofficeUserMenu.tsx`](../../apps/content-backoffice/src/layout/BackofficeUserMenu.tsx)), de a `getIdentity` ([`authProvider.ts`](../../apps/content-backoffice/src/auth/authProvider.ts)) nem ad `avatar` értéket, és a [`ProfilePage.tsx`](../../apps/content-backoffice/src/pages/profile/ProfilePage.tsx)-en nincs feltöltés. Hiányzik a user avatar mező, a feltöltés és a megjelenítés.

### 3.3 Receipt összekötés

- Már kész (v1-ben): egy tranzakcióhoz több bizonylat tartozik, a create és a review űrlap több bizonylatkártyát kezel ([`ReceiptFields.tsx`](../../apps/content-backoffice/src/pages/transactions/ReceiptFields.tsx), [`receiptDraft.ts`](../../apps/content-backoffice/src/data/receiptDraft.ts)).
- **Még hiányzik:** egy receipt több tranzakcióhoz. A séma ma `receipt.transaction` manyToOne ([`receipt/schema.json`](../../src/api/receipt/content-types/receipt/schema.json)), a `transaction.receipts` oneToMany ennek a fordítottja, tehát egy bizonylat egy tranzakcióé. A több tranzakciós bizonylathoz sémaváltás kell (N:M), és az SPA-n a meglévő receipt kiválasztása create közben.

### 3.4 QA workflow erősítés

- Értesítés új draftokról
- Review sor / hozzárendelés
- Visszautasítás kötelező megjegyzéssel (ha üzletileg kell)

A rögzítő és a publikáló audit mező (`entered_by`, `published_by`, `createdAt`, `publishedAt`) a [v1 §9.5](./0001-content-backoffice-v1.md#95-audit-mezők) része. A publish őr az `editor` szerepen marad.

### 3.5 Könyvelési kör

A [domain use case-ek](../readme.md#use-cases) magja. A lista önmagában nem helyettesíti. Állapot: **nincs implementálva**, egyetlen részlet kivételével: a seeder-import idempotens (`entered_key` + részleges unique index, [`transaction-import-key.ts`](../../src/transaction-import-key.ts), [`transactions.http`](../../database/seeders/http/common/transactions.http)), de ez nem SPA-s import.

- Egyenleg és előzmény tagonként, illetve projektenként; a boardnak összesítve. Az egyenleg előre számolt összesítés (szervezet, számla, pénznem, időszak), nem lista-soronként újraszámolt összeg.
- Ismétlődő tagdíj és ütemezett terhelés, idempotens futással: egy újrafuttatás nem dupláz sort.
- Kivonat- és számlatükör-import előnézettel és az elutasított sorok naplójával.
- A tranzakción a pénznem és a végső összeg rögzül, az árfolyam **nem** (döntés, 2026-11-08). Az árfolyammal számolt összeg (pl. a transaction-workflow Convert árfolyamos lépése) a rögzítéskor fix, a későbbi `currency-rate` változás a régi egyenleget nem írja át. A részletes adatmodell-megjegyzés a [readme](../readme.md#accounting-loop-before-new-domains) alatt van.

### 3.6 AJAX loading spinner

A v1 a jogosultság betöltése alatt üresen hagyja a felületet. **Részben kész:** a react-admin saját jelzése él (app bar `LoadingIndicator`, [`BackofficeAppBarToolbar.tsx`](../../apps/content-backoffice/src/layout/BackofficeAppBarToolbar.tsx); lista és megtekintés), a bejelentkezésnél van `CircularProgress` ([`LoginPage.tsx`](../../apps/content-backoffice/src/login/LoginPage.tsx)), a create mentés ([`TransactionCreateToolbar.tsx`](../../apps/content-backoffice/src/pages/transactions/TransactionCreateToolbar.tsx), a bizonylatfeltöltéssel együtt), a tömeges jóváhagyás és az Ügylet kifejtése gomb `loading` állapotot kap. **Még hiányzik:** a [`RoleGuard.tsx`](../../apps/content-backoffice/src/auth/RoleGuard.tsx) és a [`WorkflowFormGate.tsx`](../../apps/content-backoffice/src/workflows/WorkflowFormGate.tsx) a jogosultság és a backoffice config betöltésekor még `null`-t ad (üres képernyő), a [`BackofficeConfigProvider.tsx`](../../apps/content-backoffice/src/workflows/BackofficeConfigProvider.tsx) betöltése alatt nincs jelzés, a véglegesítés gombja ([`TransactionFinalizeSection.tsx`](../../apps/content-backoffice/src/pages/transactions/TransactionFinalizeSection.tsx)) csak `disabled` spinner nélkül, és az egységes szabály (lezárásig marad, háttérkérés nem rak ki teljes oldalas spinnert) nincs közös komponensbe kiírva. v2-ben az AJAX kérés, ami a képernyőt vagy egy vezérlőt várakoztat, loading spinnert mutat a válasz megérkezéséig.

- Lista, megtekintés, create mentés, bizonylatfeltöltés, véglegesítés, bejelentkezés, jogosultság és a backoffice config. Ahol a react-admin spinnerje már fedi a kérést, az marad.
- A spinner a válaszra leáll. Üres találatnál az üres állapot, hibánál az üzenet látszik.
- Több blokkoló kérésnél a spinner az utolsó lezárásáig marad. A kész képernyőn futó háttérkérés nem rak ki új, teljes oldalas spinnert.

## 4. Hosting és CI/CD

### 4.1 Subdomain (opcionális)

- `backoffice.kor.fejlesztesek.hu` mellett vagy helyett a path-alapú `/backoffice` mellett.

### 4.2 Minőségkapu: a még hiányzó rész

A pre-commit hook ([`lefthook.yml`](../../lefthook.yml)) és a CI ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) már ugyanazt a kaput futtatja (Prettier, SPA lint, typecheck, Strapi tesztek és build, SPA build, lint és vitest; a publish őr tesztje a `src/**/*.test.ts` része). Részletek: [§9](#9-implementálva-2026-11-03). Nyitott:

- **A `main` branch protection nincs bekapcsolva.** `gh api repos/pitiboy/curr/branches/main/protection` 2026-11-03-án `404 Branch not protected`. A beállítás GitHub-oldali, a lépések a [`docs/ci/branch-protection.md`](../ci/branch-protection.md)-ben vannak. Cél:
  - közvetlen push a `main`-re tiltott, változás csak pull requesten át megy;
  - kötelező státuszellenőrzések: **Prettier check**, **Typecheck**, **Strapi build and tests**, **Backoffice lint and tests**;
  - merge előtt a branch legyen naprakész a `main`-nel;
  - force-push és a `main` törlése tiltott.
- **Strapi oldali lint lépés nincs.** Az SPA-n az `oxlint` fut a hookban és a CI-n, a gyökér `package.json`-ban nincs `lint` script, és sem a `lefthook.yml`, sem a `ci.yml` nem futtat lintet a `src/` fán. A Strapi lint ugyanúgy a kapu része legyen, mint az SPA-é.

### 4.3 Üzemeltetési alap

Állapot: **nincs implementálva** (a repóban nincs Sentry-függőség, kérésazonosító vagy health endpoint, és a [`docs/deploy`](../deploy/content-backoffice-kor.md) alatt nincs üzemeltetési jegyzet).

- Strukturált log kérésazonosítóval. A loggyűjtés, a hibagyűjtő és a remote hibakeresés a Sentry, a Strapi és az SPA oldalán is, hogy egy mentés utólag köthető legyen egy Neon- vagy cPanel-hibához.
- A Strapi az `@sentry/node` SDK-t használja, az SPA az `@sentry/react` SDK-t. `SENTRY_DSN`, illetve a buildbe égetett `VITE_SENTRY_DSN` nélkül a bekötés nem küld semmit. A DSN nincs a repóban.
- Loggyűjtés: a Sentry Logs. A kérésazonosító a mentésen és a hibás válaszon rajta van. A kérés törzse, a jelszó, a token és a süti kimarad.
- Remote hibakeresés: issue, a böngészős mentést a Strapi kéréssel összekötő trace, és az SPA-n hibakor session replay. A replay a beviteli mezőket maszkolja, a bizonylat képét nem küldi. Source map csak `SENTRY_AUTH_TOKEN` mellett töltődik fel, a böngészőnek nem megy ki.
- Health endpoint, és egy rövid üzemeltetési jegyzet: Neon backup, Cloudinary, env, seedelt számlakódok, smoke login `dataentry` és `editor` szereppel.

## 5. Teljesítmény

Amíg az adat még kicsi, a lista- és jelentésút legyen olcsó. Állapot: **nincs implementálva.** A lista ma minden draft és published sort végiglapoz 100-asával, és az SPA-ban rendez és lapoz ([`dataProvider.ts`](../../apps/content-backoffice/src/data/dataProvider.ts) `fetchTransactions`, [`transactionList.ts`](../../apps/content-backoffice/src/data/transactionList.ts) `assembleTransactionList`). A `populate` a listán is bővebb a javasoltnál. A [`currency-rate`](../../src/api/currency-rate/services/currency-rate.ts) service üres core service, dátum szerinti lookup nincs (a `findLatestRate` a [0002 plan §5.1](../plans/0002-transaction-workflow-content-type.md#51-árfolyamos-lépés-apply_currency_rate) része). A tranzakció sémában nincs árfolyam mező, és nem is lesz ([`transaction/schema.json`](../../src/api/transaction/content-types/transaction/schema.json)). Az egyetlen index az `entered_key` részleges unique indexe.

- A lista lapozott, szűk mezőlistával: dátum, összeg, státusz, szervezet, debit és credit kód, bizonylat azonosító. A teljes `populate` a részletezőn marad.
- Index a szűrőoszlopokra: `date`, publikált státusz, szervezet, debit és credit számla. A Strapi draft és published párokat státuszszűrővel kéri az API.
- Árfolyam dátum szerint cache-elt lookup, nem soronkénti rate-lekérdezés. A tranzakció árfolyamot nem tárol, csak a rögzítéskor fixált összeget ([§3.5](#35-könyvelési-kör)).
- A listában a bizonylat bélyegkép vagy link. Az eredeti fájl a Cloudinaryn marad, a részletező tölti le.
- Az SPA resource-onként töltődik. Az organizations, members és accounts képernyők nincsenek az első bundle-ben.

## 6. Auth bővítések (ha kell)

Ezek a könyvelési kör és az üzemeltetési alap után jönnek.

- További OAuth providerek a Google mellé (Users & Permissions).
- Invite email UX finomítás (sablon, lejárat, újraKüldés).
- Jelszó reset self-service a profil / login flow-ból (ha v1-ben nincs).

## 7. Priorizálási javaslat (nem kötelező sorrend)

1. Org–user ACL + szerveroldali szűrés
2. Sentry: strukturált log kérésazonosítóval, hibagyűjtő és remote hibakeresés a Strapi és az SPA oldalán; health endpoint, üzemeltetési jegyzet
3. A `main` branch protection bekapcsolása és a Strapi lint a kapuban (a hook és a CI már megvan)
4. AJAX loading spinner a még hiányzó helyeken
5. Lapozott lista, szűk mezők, indexek, bizonylat bélyegkép
6. Cache-elt rate lookup, előre számolt egyenleg
7. Tag- és projektegyenleg, ismétlődő tagdíj, import előnézettel
8. Receipt N:M UI, majd a QA sor (értesítés, hozzárendelés, visszautasítás megjegyzéssel)
9. Csak utána: menükatalógus (resource-onkénti bundle-lel), user–member összerendelés, avatar, további OAuth, jelszó-reset, meghívó, subdomain

Elkészült az előző lista 4. (allowlist configba), 5. (séma és jog csak kódból) és a 3. pont hook + CI része: lásd [§9](#9-implementálva-2026-11-03).

## 8. Kapcsolat a v1 DoD-hoz

A v2 elemek **nem** részei a [v1 Definition of Done](./0001-content-backoffice-v1.md#12-sikerkritérium-definition-of-done)-nak. Új PRD / ticket vágás a v1 ship után.

## 9. Implementálva (2026-11-03)

Ezek az eredeti v2 tételek kódban megvannak (a szakaszszámok a 2026-10-15-i változatra utalnak). A helyük ebben a PRD-ben nem nyitott követelmény, a lista a történet megőrzésére van.

| Eredeti tétel                         | Mi van meg                                                                                                                                                                                                                                                                                                               | Hol                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §3.4 Számla-allowlist konfiguráció    | A debit és credit kódminta `Setting` sorokból jön (`accounts.debit_codes`, `accounts.credit_codes`), a `GET /api/backoffice/config` adja, az SPA ebből építi a számlaválasztót. Seed: `10-backoffice-features.http`. Az alap `/^5/` és `/^(1\|3)/` csak tartalék.                                                        | [`src/backoffice-features/`](../../src/backoffice-features/constants.ts), [`src/api/backoffice/`](../../src/api/backoffice/config.ts), [`useAccountCodePatterns.ts`](../../apps/content-backoffice/src/workflows/useAccountCodePatterns.ts), [`accountCodes.ts`](../../apps/content-backoffice/src/data/accountCodes.ts) |
| §4.2 GitHub Actions pipeline          | CI minden pull requesten és `main` pushon (Prettier check, typecheck, Strapi tesztek és build, SPA build + lint + vitest). cPanel deploy kézi `workflow_dispatch`-csel, FTP, kézi jóváhagyásos environment (`KOR.fejlesztesek.hu-manual-approval`). A korábbi YAML skeleton elavult, a PRD-ből kikerült.                 | [`ci.yml`](../../.github/workflows/ci.yml), [`deploy-cpanel.yml`](../../.github/workflows/deploy-cpanel.yml), [`docs/ci/github-actions-cpanel.md`](../ci/github-actions-cpanel.md)                                                                                                                                       |
| §4.3 Pre-commit kapu és CI ugyanazzal | `lefthook` pre-commit: Prettier a staged fájlokon, SPA oxlint, typecheck, Strapi tesztek és SPA vitest az érintett fájloknál. A CI Prettier `--check` módban fut. A publish őr tesztje a Strapi tesztek része. A branch protection beállítása és a Strapi lint **nyitott** ([§4.2](#42-minőségkapu-a-még-hiányzó-rész)). | [`lefthook.yml`](../../lefthook.yml), [`package.json`](../../package.json) (`typecheck`, `format:check`, `ci:backoffice`), [`publish-guard.test.ts`](../../src/publish-guard.test.ts), [`docs/ci/branch-protection.md`](../ci/branch-protection.md)                                                                      |
| §4.4 Séma és jogosultság csak kódból  | A `dataentry` és `editor` szerep jogai a bootstrapban íródnak (`ensureUsersPermissionsRoles`), az editor-only action (Convert) is. A sémák a repóban vannak.                                                                                                                                                             | [`src/index.ts`](../../src/index.ts)                                                                                                                                                                                                                                                                                     |
| §3.3 egy tranzakció, több bizonylat   | A create és a review űrlap több bizonylatkártyát kezel. A fordított irány (egy bizonylat több tranzakcióhoz) **nyitott** ([§3.3](#33-receipt-összekötés)).                                                                                                                                                               | [`ReceiptFields.tsx`](../../apps/content-backoffice/src/pages/transactions/ReceiptFields.tsx), [`receiptDraft.ts`](../../apps/content-backoffice/src/data/receiptDraft.ts)                                                                                                                                               |
| §3.6 idempotens futás (csak a seeder) | A seeder tranzakcióimportja `entered_key`-vel idempotens. Az SPA-s import és az ismétlődő tagdíj **nyitott**.                                                                                                                                                                                                            | [`transaction-import-key.ts`](../../src/transaction-import-key.ts), [`transactions.http`](../../database/seeders/http/common/transactions.http)                                                                                                                                                                          |

Nem v2-tétel, de a v2 felületét érinti és megvan: az **Ügylet kifejtése** (Convert) a listán, a review-n és a create-en ([`plans/0003`](../plans/0003-transaction-workflow-backoffice.md)); a publish őr a `editor` szerepen és az audit mezők ([v1 §9.5](./0001-content-backoffice-v1.md#95-audit-mezők)).

## 10. Backlog itemek

A nyitott tételekből a [CURR - KÖR project](https://github.com/users/pitiboy/projects/2)-ben draft backlog item készült (Status: Backlog). Becslés story pointban.

| Item                                                                | PRD      | SP  |
| ------------------------------------------------------------------- | -------- | --- |
| Org–user ACL szerveroldali szűréssel                                | §2.1     | 8   |
| User ↔ member összerendelés                                         | §2.2     | 3   |
| Menükatalógus: törzsadat resource-ok az SPA-ban                     | §3.1, §5 | 8   |
| Profil avatar feltöltés és megjelenítés                             | §3.2     | 3   |
| Receipt több tranzakcióhoz (N:M) és meglévő receipt választása      | §3.3     | 5   |
| QA workflow: értesítés, hozzárendelés, visszautasítás megjegyzéssel | §3.4     | 8   |
| Cache-elt rate lookup (árfolyam nem kerül a tranzakcióra)           | §3.5, §5 | 5   |
| Egyenleg tagonként és projektenként (előre számolt összesítés)      | §3.5     | 8   |
| Ismétlődő tagdíj és ütemezett terhelés                              | §3.5     | 8   |
| Kivonat- és számlatükör-import előnézettel és hibanaplóval          | §3.5     | 8   |
| AJAX loading spinner a hiányzó helyeken                             | §3.6     | 3   |
| `main` branch protection bekapcsolása                               | §4.2     | 1   |
| Strapi lint a minőségkapuban                                        | §4.2     | 2   |
| Subdomain a backoffice-nak (opcionális)                             | §4.1     | 2   |
| Sentry bekötés: kérésazonosítós log, hibagyűjtő, session replay     | §4.3     | 8   |
| Health endpoint és üzemeltetési jegyzet                             | §4.3     | 2   |
| Lapozott lista szerveroldalon, szűk mezőkkel                        | §5       | 8   |
| Adatbázis indexek a szűrőoszlopokra                                 | §5       | 2   |
| Bizonylat bélyegkép a listában                                      | §5       | 2   |
| További OAuth providerek                                            | §6       | 3   |
| Jelszó reset self-service                                           | §6       | 3   |
| Meghívó email UX                                                    | §6       | 2   |
