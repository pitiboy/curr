---
name: content-backoffice-spa
description: >-
  Builds the content-backoffice Vite React Admin 5 app on ra-strapi: Content
  API login, documentId, role-gated transaction pages, account-code filters,
  receipt upload, Hungarian i18n, and the /backoffice static deploy. Use when
  implementing or changing apps/content-backoffice, react-admin screens,
  ra-strapi, backoffice login, i18n, or the cPanel /backoffice path.
---

# Content backoffice SPA

A képernyők és a szerepek a `docs/prd/0001-content-backoffice-v1.md` §4–§6 és §10. A provider-határok a `docs/adr/0001-react-admin-content-ui.md`. Ez a skill a bekötés sorrendje.

## App

Helye: `apps/content-backoffice`. Nx `appsDir` már `apps` az `nx.json`-ban. A Strapi app marad a repo gyökerében; ne olvaszd össze a kettőt.

- Vite + React + TypeScript. Függőség: `react-admin` 5, `ra-strapi`, MUI a react-admin peerjei szerint.
- `vite.config.ts` `base: '/backoffice/'`.
- `VITE_STRAPI_URL` a Strapi origin, path nélkül (lokálisan `http://localhost:1337`, élesen `https://kor.fejlesztesek.hu`).

## Provider

```tsx
const STRAPI_URL = import.meta.env.VITE_STRAPI_URL;
const authProvider = strapiAuthProvider({ baseURL: STRAPI_URL });
const httpClient = strapiHttpClient();
const dataProvider = withDocumentId(
  strapiDataProvider({ baseURL: STRAPI_URL, httpClient })
);
```

`withDocumentId`: a getOne, update és delete paraméter `id`-ja, valamint a create/update válasz rekord `id` mezője a `documentId`. A reláció referencia értéke is `documentId`. Ha az `ra-strapi` ezt már így adja, a wrapper no-op és egy teszt rögzíti.

A `loginPage` a react-admin `LoginWithEmail`, plusz egy Google gomb. A Google a Strapi `/api/connect/google` flow-ja. A visszakapott Content JWT-t ugyanoda tedd, ahová a `strapiAuthProvider` a local login tokenjét írja; a tárolást a telepített `ra-strapi` auth provider forrásából olvasd ki, ne találj ki második tokenkulcsot.

Az `authProvider.getPermissions` a `/api/users/me?populate=role` válaszából a role `type` értéket adja: `dataentry` vagy `editor`. Az `ra-strapi` ezt nem tölti ki.

A transaction create mindig `status=draft`, `dataentry` és `editor` szerepnél is. A REST status nélkül publishedet ír, és a szerver a `dataentry` publisht 403-mal elutasítja.

## Oldalak

Egy resource, neve `transactions` (a séma `pluralName`). Egyedi List, Create és a review route. Guesser nincs az éles fában.

| Route | Szerep | Viselkedés |
| --- | --- | --- |
| `/transactions/create` | `dataentry`, `editor` | Create. Mentés draft. Publish nincs. |
| `/transactions/review` | `editor` | Lista `status=draft`. Show/edit. Publish gomb. |
| `/transactions` | mindkettő | Draft és published. Szűrő. Nincs create, edit, publish. |
| `/login` | vendég | Email/jelszó és Google. |
| `/profile` | mindkettő | Név, email. Jelszócsere csak `provider === 'local'`. |

A menü mindkét szerepnek mutatja a create elemet. A review elemet csak az `editor` látja. Ismeretlen szerep egyik író oldalt sem kapja meg.

A create és a review mezői: `date`, `amount`, `currency_type`, `description`, `organization`, `debit_account`, `credit_account`, opcionális `receipt`. A `transaction_type` és a `related_transaction` nincs a v1 űrlapon.

Szűrők a listán: `status`, `date` tartomány, `amount`, `organization`, `debit_account`, `credit_account`, `description`.

A lista és a review mutatja az `entered_by` értéket és a `createdAt` időt. Published soron a `published_by` értéket és a `publishedAt` időt is. A create és az edit űrlapon ezek a mezők nincsenek.

## Számlakód

A választó a lekért accountok kliens szűrője. Forrás a `database/seeders/org-initializer.js` asset és expense blokkja.

- Debit: `VITE_DEBIT_CODES` regex. Ha nincs megadva, `/^5/`.
- Credit: `VITE_CREDIT_CODES` regex. Ha nincs megadva, `/^(1|3)/`.

A kódlista nem szerver policy. Üres selectnél a seed hiányzik, ne bővítsd a listát csendben más kódokkal.

## Receipt

A transaction `receipt` reláció opcionális. Üres receipttel a tranzakció menthető.

Ha a felhasználó bizonylatot csatol:

1. `POST /api/upload` multipart, a Content JWT-vel, a fájl a `files` mezőben.
2. Receipt create `?status=draft`: a `document` a feltöltés id-ja. A `vendor` mehet üresen. A `date`, `amount` és `description` előtöltés a tranzakcióból; a séma ezeket kötelezőnek tartja a receipt soron.
3. A transaction `receipt` mezője a receipt `documentId`.

A review a receipt dokumentumát linkkel vagy előnézettel mutatja, ha van. A lista egy receipt oszlopot mutat.

## Profil és i18n

Profil: `GET /api/users/me`. Jelszócsere: `POST /api/auth/change-password` (`currentPassword`, `password`, `passwordConfirmation`). Google providernél a jelszó űrlap nincs a képernyőn.

`i18nProvider`: default locale `hu`, második katalógus `en`. A react-admin és a saját címkék mindkét katalógusban szerepelnek. A `hu` a böngészőnyelvtől függetlenül az alap.

## Deploy

`vite build`, a `dist` a `kor.fejlesztesek.hu/backoffice` path statikus fájljai. Az API ugyanaz az origin. A lépést a `docs/deploy/` alá írd, a meglévő cPanel alias jegyzet mellé. CI pipeline nincs.

## Kész, ha

A §10 storyjai és a §12 checklistje teljesül. Az acceptance subagent (`backoffice-acceptance`) a diffet storynként pass/fail listára bontja; a DoD pipa csak azután kerül a PRD-be.
