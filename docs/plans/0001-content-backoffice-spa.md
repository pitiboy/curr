# Implementation plan: Content backoffice SPA

**Status:** 4. lépés kész (Human ellenőrzésre vár)  
**PRD:** [0001-content-backoffice-v1](../prd/0001-content-backoffice-v1.md)  
**ADR:** [0001-react-admin-content-ui](../adr/0001-react-admin-content-ui.md)  
**Skillek:** `.cursor/skills/content-backoffice-spa`, `.cursor/skills/strapi-publish-guard`  
**Szabályok:** `.cursor/rules/backoffice-v1-scope.mdc`, `content-backoffice-spa.mdc`, `strapi-publish-guard.mdc`

Egy másik agent ezt a fájlt hajtja végre. A PRD §8 (szervezet, tag, ACL, avatar, CI, subdomain, receipt N:M, Enterprise RBAC és realtime) nem része egyik lépésnek sem. Az audit mezők igen: a PRD §9.5, az 5. és a 8. lépés.

## Hogyan kell végrehajtani

- Egyszerre egy számozott lépés. A lépés feladatai közül csak a még üres négyzetek kerülnek kódba.
- A lépés végén az agent kipipálja a saját négyzeteit, és **megáll** a Human sor előtt. A Human négyzetet nem pipálja ki, és a következő lépést nem kezdi el.
- A Human kipróbálja a leírt utat, kipipálja a saját sorát, és csak utána indítja a következő lépést.
- Ha a próba bukik, a következő agent ugyanennek a lépésnek a javítását csinálja, nem a következőt.
- A Strapi gyökér `package.json` nem kap React Admin függőséget. Az SPA saját csomag az `apps/content-backoffice` alatt, külön `node_modules`.
- Éles képernyőn nincs `ListGuesser`, `EditGuesser`, `ShowGuesser`. Az azonosító a `documentId`.

Lokálisan a Strapi a `1337`-es porton fut (`npm run dev` a repo gyökerében). Az SPA dev címe `http://localhost:5173/backoffice/`, mert a Vite `base` a `/backoffice/`. A `VITE_STRAPI_URL` az 1–9. lépésben `http://localhost:1337`. Az éles `kor.fejlesztesek.hu` csak a 10. lépés deploy célja; fejlesztés közben oda nem megy írás.

A helyi adatbázis szervezetei és számlái már seedelve vannak. Üres debit vagy credit selectnél az agent megáll és jelzi, nem futtat seedet, és nem bővíti a kódlistát. A helyi Cloudinary a Strapi `.env`-jében van; az agent a kulcsokat és a providert nem módosítja.

A fejlesztői Strapi CORS-a nyitott (`config/middlewares.ts`, nem production). A gyökér `package.json` React 18-as függőségéhez az agent nem nyúl; az SPA saját `node_modules`-ában hozza a saját Reactjét. A `ra-strapi` verziója `1.0.3`, az ADR szerint.

---

## 1. Vite váz

Üres React Admin keret, magyar felülettel, API hívás nélkül.

A váz megvan. A Human próba bukott: a `http://localhost:5173/backoffice/` a beépített angol „Welcome to React-admin” splash-t mutatja, app sáv és menü nélkül, angol felirattal. Csak az üres négyzeteket javítsd. A 2. lépést ne kezdd el.

- [x] `apps/content-backoffice` Vite + React + TypeScript app, saját `package.json` és lockfile
- [x] Nx `project.json`: `dev` és `build` az app mappájában fut
- [x] `vite.config.ts` `base: '/backoffice/'`
- [x] `.env.example` a `VITE_STRAPI_URL` kulccsal
- [x] `react-admin` 5 `Admin`, MUI, resource nincs, API hívás nincs (`requireAuth={false}`, noop dataProvider)
- [x] i18nProvider bekötve: alapértelmezett `hu`, `en` katalógus a repóban
- [x] `vite build` lefut
- [x] A `/backoffice/` címen a keret látszik: app sáv és oldalsó menü. A menüben egy placeholder van („Nincs menüpont”), resource nincs. Az angol Ready splash nem marad a képernyőn.
- [x] A keret feliratai magyarul jönnek. A nyelvváltó „Magyar”. Az app sáv címe „Tartalom kezelő”. Konzolhiba nincs.

A react-admin 5 alap routere hash router. Resource és custom route nélkül az `Admin` a `Ready` splash-t rajzolja, a Layout és az i18n kimarad. A látható keretet a `ready` prop adja, amíg nincs resource. A 3. lépés resource-ai után ez a prop nem fut. Ne tegyél a helyére `/` custom route-ot: az ott maradna, és eltakarná a későbbi kezdő útvonalat.

Az `Admin` `basename` propját ne állítsd `/backoffice`-ra. A Vite `base: '/backoffice/'` már ezt a pathot szolgálja. Hash routeren a basename a hashra vonatkozik; a `/backoffice/` cím ettől üres oldal, ezzel a konzolhibával: `<Router basename="/backoffice"> is not able to match the URL "/"`.

A nyelv nem URL. A váltó a `RaStore.locale` localStorage kulcsot írja, a cím `http://localhost:5173/backoffice/` marad. A `/backoffice/en` nem locale útvonal.

- [x] **Human:** `dev` elindul, a böngésző a `/backoffice/` útvonalon magyar react-admin keretet mutat (app sáv, menü a „Nincs menüpont” placeholderrel, „Tartalom kezelő”, nyelvváltó „Magyar”), konzolhiba nélkül. Az angol „Welcome to React-admin” splash nem elég. A nyelvváltó Englishre állítva a cím „Content backoffice”, a menü „No menu items”, az URL nem változik. Ha igen, pipáld ki, és indítsd a 2. lépést.

## 2. Szerepek, hogy legyen kivel belépni

A login próba előtt a két Content szerepnek léteznie kell. A jogmátrix és a bootstrap a `strapi-publish-guard` skill szerint készül. A publish őr és a `vendor` séma még nem ebben a lépésben van.

- [x] `src/index.ts` `bootstrap()`: idempotens `dataentry` és `qa` role `type`, productionben is
- [x] Jogok: transaction és receipt find, findOne, create, update; organization és account find, findOne; content-api upload. Delete nincs
- [x] Ismételt indulás nem duplikálja a role és permission sorokat

- [x] **Human:** Strapi Admin → Users & Permissions. Létrehozol egy `dataentry` és egy `qa` Content usert (email + jelszó). Mindkettővel a `/api/auth/local` 200-at és JWT-t ad. Ha igen, pipáld ki, és indítsd a 3. lépést.

## 3. Local login és üres route-ok

- [x] `strapiAuthProvider` + `strapiHttpClient` + `strapiDataProvider`, `LoginWithEmail`
- [x] `withDocumentId`: az `id` a `documentId`. Ha a telepített `ra-strapi` 1.0.3 már így adja, a wrapper no-op, és egy Vitest teszt az app csomagjában rögzíti. A teszt a Strapi gyökerébe nem kerül
- [x] `getPermissions` a `/api/users/me?populate=role` role `type` mezőjéből
- [x] Resource név: `transactions`. Három route üres állapottal, guesser nélkül:
  - `/transactions/create` csak `dataentry`
  - `/transactions/review` csak `qa`
  - `/transactions` mindkét szerep, szerkesztés nélkül
- [x] Profil oldal: név és email. Jelszócsere még nincs
- [x] A menü a szerep szerint rejti a create vagy a review elemet. Ismeretlen szerep egyik író oldalt sem látja
- [x] A Google gomb helye disabled, amíg a 9. lépés be nem köti

- [x] **Human:** `dataentry` belép, látja az Új tranzakciót és a listát, a review URL-t nem éri el. Kijelentkezés után a `qa` látja a review-t és a listát, a create URL-t nem éri el. A profil a nevet és az emailt mutatja. Ha igen, pipáld ki, és indítsd a 4. lépést.

## 4. Readonly lista

- [x] A lista a Content API-ról jön, `documentId` azonosítóval. A REST find alapból csak publishedet ad, ezért a lista külön kéri a `status=draft` és a `status=published` rekordokat, és a kettőt együtt mutatja
- [x] Oszlopok: dátum, összeg, leírás, szervezet, debit, credit, státusz, receipt jelzés
- [x] Szűrők: `status`, `date` tartomány, `amount`, `organization`, `debit_account`, `credit_account`, `description`
- [x] Erről a nézetről nincs create, edit, publish gomb és nincs sor-kattintás szerkesztőbe

- [x] **Human:** mindkét szereppel a lista betölt. A státuszszűrő leszűkíti a sorokat. Egy sor megnyitása nem visz szerkesztőbe. Ha a lista üres, seedelt tranzakció nélkül is elfogadható, ha a szűrő és az üres állapot hibamentes. Ha igen, pipáld ki, és indítsd az 5. lépést.

## 5. Publish őr és receipt séma

A create űrlap előtt a szervernek draftot kell kényszerítenie, és a vendor mezőnek opcionálisnak kell lennie. Részletek a `strapi-publish-guard` skillben.

- [ ] `receipt.vendor` `required: false`. A `document` kötelező marad
- [ ] Document Service middleware a `src/index.ts` `register()`-ben, transaction és receipt uid-ra
- [ ] Content API-n csak `qa` publikálhat. A `dataentry` publish / unpublish / `status=published` írása 403, a mentés nem válik csendben publisheddé
- [ ] Admin Content Manager publish továbbra is megy
- [ ] `transaction` és `receipt` séma: `entered_by` és `published_by` string, nem kötelező. A middleware create-kor a Content user e-mailjét írja `entered_by`-ba. Publish-kor a `qa` e-mailjét írja `published_by`-ba, unpublish-kor üríti. A kliens payloadja egyik mezőt sem írja felül. User reláció és user `find` jog nincs

- [ ] **Human:** `dataentry` JWT-vel a `POST /api/transactions` status nélkül vagy `?status=published` 403. Ugyanez a token `?status=draft` mellett draftot hoz létre, és a válasz `entered_by` mezője a belépett user e-mailje akkor is, ha a body más e-mailt küldött (ezt a hívást utána törölheted). `qa` tokennel ugyanaz a rekord publisheddé tehető, és a `published_by` a `qa` e-mailje. Ha igen, pipáld ki, és indítsd a 6. lépést.

## 6. Új tranzakció, receipt nélkül

- [ ] Create űrlap a `dataentry` route-on: `date`, `amount`, `description`, `organization`, `debit_account`, `credit_account`
- [ ] Debit választó: `5000`, `5100`, `5400`. Credit választó: `code` illeszkedik `^1`-re
- [ ] Mentés mindig `?status=draft`. Publish gomb nincs
- [ ] A `transaction_type`, `currency_type`, `related_transaction` nincs az űrlapon. Az `entered_by` és a `published_by` sem űrlapmező
- [ ] Sikeres mentés után a rekord a readonly listán draftként látszik

- [ ] **Human:** `dataentry` felvisz egy kiadást receipt nélkül. A debit listában csak a három költségkód van, a credit listában az `1`-gyel kezdődő számlák. Mentés után a lista draftot mutat, Publish gomb sehol. Ha a select üres, a seed hiányzik: azt jelezd, ne bővítsd a kódlistát. Ha igen, pipáld ki, és indítsd a 7. lépést.

## 7. Opcionális bizonylat

- [ ] A create és a review űrlapon a receipt blokk kihagyható
- [ ] Csatoláskor: `POST /api/upload` a Content JWT-vel, majd receipt create `?status=draft`. A `document` a feltöltött fájl. A `vendor` üres lehet. A dátum, összeg és leírás előtöltődik a tranzakcióból
- [ ] A transaction `receipt` mezője a receipt `documentId`
- [ ] A lista receipt oszlopa jelzi, ha van bizonylat. A review megnyitja a fájlt

- [ ] **Human:** egy tranzakció receipt nélkül menthető. Egy másik fájllal, üres vendorral menthető, és a listán valamint a `qa` review-n a fájl megnyitható. Ha igen, pipáld ki, és indítsd a 8. lépést.

## 8. QA review és publish

- [ ] A review lista csak `status=draft`
- [ ] Show/edit: a tranzakció mezői és a receipt, ha van
- [ ] Publish gomb csak itt, csak `qa` szerepnek. Sikeres publish után a rekord published, és a kapcsolt receipt published verziója is megvan
- [ ] A review és a readonly lista mutatja az `entered_by` értéket és a `createdAt` időt. Published soron a `published_by` értéket és a `publishedAt` időt is. A mezők nem szerkeszthetők
- [ ] A `dataentry` a review route-ot továbbra sem éri el, és a listáról nem publikál

- [ ] **Human:** `qa` egy draftot megnyit, látja a bizonylatot, ha van, és a rögzítő e-mailjét. A Publish után a lista published státuszt mutat, a publikáló e-mailjével. `dataentry` ugyanezt a rekordot nem tudja publikálni a felületről. Ha igen, pipáld ki, és indítsd a 9. lépést.

## 9. Profil jelszó és Google

A Google kliens azonosító és titok a Humané. Az agent env kulcsot olvas, értéket nem ír a repóba.

- [ ] Local usernél jelszócsere: `POST /api/auth/change-password`
- [ ] `provider !== 'local'` esetén a jelszó űrlap nincs a képernyőn
- [ ] `config/plugins.ts` users-permissions `grant.google`, `GOOGLE_CLIENT_ID` és `GOOGLE_CLIENT_SECRET`
- [ ] A login Google gombja a Strapi `/api/connect/google` flow-ját indítja, a JWT ugyanoda kerül, ahová a local login tokenje
- [ ] A deploy jegyzetben a callback: a Strapi host `/api/connect/google/callback`, és a `https://kor.fejlesztesek.hu/backoffice` redirect

- [ ] **Human:** local userrel a jelszócsere után az új jelszóval be lehet lépni. A Google gomb a konzolon beállított klienssel Content userként beléptet; ha a kliens még nincs meg, a gomb és a jegyzet elég, a local jelszócsere viszont kötelezően működjön. Ha igen, pipáld ki, és indítsd a 10. lépést.

## 10. Deploy jegyzet és átvétel

- [ ] `docs/deploy/` alá rövid jegyzet: `vite build`, a `dist` a `kor.fejlesztesek.hu/backoffice` pathra, `VITE_STRAPI_URL` ugyanaz az origin. CI pipeline nincs
- [ ] A `backoffice-acceptance` subagent a §10 storykra és a §12 DoD-ra pass/fail listát ad
- [ ] A PRD §12 négyzeteit csak a Human pipálja, az agent nem

- [ ] **Human:** a deploy jegyzet alapján a build kimegy a `kor.fejlesztesek.hu/backoffice` pathra, az oldal a hoston betölt, az API ugyanaz az origin. Az acceptance lista storynként pass, vagy a nyitott fail nevén van. Utána a PRD §12 sorai kipipálhatók. A fejlesztés alatti helyi adat és a helyi userök nem kerülnek az éles adatbázisba.
