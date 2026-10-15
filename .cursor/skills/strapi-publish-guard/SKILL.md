---
name: strapi-publish-guard
description: >-
  Enforces Strapi 5.58 draft versus publish for transaction and receipt,
  seeds the dataentry and editor Users & Permissions roles, makes receipt.vendor
  optional, and configures the Google provider. Use when editing draft and
  publish, Users & Permissions roles, the receipt schema, src/index.ts
  bootstrap, or the Google grant in config/plugins.ts.
---

# Strapi publish őr

A követelmény a `docs/prd/0001-content-backoffice-v1.md` §9. Ez a skill a repo útját rögzíti. Strapi **5.58**. A transaction és a receipt route, controller és service gyári factory. Új policy fájlt a gyári routerre ne tegyél: a Document Service middleware minden REST írást lát.

## Séma

A `src/api/receipt/content-types/receipt/schema.json` fájlban a `vendor` `required` mezője legyen `false`. A `document` maradjon `required: true`. A `description` required marad. A transaction `receipts` mezője opcionális `oneToMany`, a receipt `transaction` mezője `manyToOne`. A `receipt_type` kötelező `manyToOne` a `receipt-type` törzsre. A törzs `draftAndPublish: false`, a nevét a `bootstrap()` idempotensen tölti.

A `transaction` és a `receipt` sémán legyen `entered_by` és `published_by`, mindkettő `string`, nem kötelező. Nem reláció: a Content user e-mailjét tárolják, user `find` jog nélkül. A `createdAt` és a `publishedAt` a dokumentum saját mezője, külön datetime nem kell.

A transaction `date`, `amount`, `currency_type`, `organization`, `debit_account`, `credit_account` és `description` mezője `required: true`. A `config/api.ts` `documents.strictRelations` értéke `true`, hogy a publish a kötelező relációkat is ellenőrizze. Piszkozatnál a séma ettől még nem ad validation hibát.

Más content type `draftAndPublish` értéke nem változik.

## Middleware

A `src/index.ts` `register({ strapi })` a `src/publish-guard.ts` `registerPublishGuard` függvényét köti a Document Service-re. Az `editor` nem lép ki korán: a `guardEffect` dönt.

- Admin, seed és user nélküli hívás (`actor` null): az őr nem ír és nem tilt.
- Transaction create és update, drafton is: a `date`, `amount`, `currency_type` és a `description` kötelező. Az `organization`, a `debit_account` és a `credit_account` hiánya vagy ürítése nem 400. A Strapi a draft mentésnél a `required` kényszert kihagyja, ezért a middleware 400-at dob, ha HTTP kérésből a négyes hiányzik vagy ürül. Update-nél a kimaradó kulcs a tárolt értéket hagyja. Request nélküli seed nem esik az ellenőrzés alá.
- Publish, a tárolt draft alapján: a hét mező (`date`, `amount`, `currency_type`, `description`, `organization`, `debit_account`, `credit_account`) ki van töltve, különben 400, és a dokumentum nem lesz published. A publish action nem hoz mezőket; a middleware `db.query` populate-tal olvassa a sort, ne `documents().findOne`.
- `dataentry` publish, unpublish, vagy create/update `status=published`: 403.
- `CONTENT_DEFAULT_STATUS` `draft` (alap): create/update `status=published` 403, editornek is. `published`: az editor create/update publikálhat, ha a másik szabály engedi.
- `CONTENT_PUBLISHER_MUST_DIFFER` igaz (alap): az `entered_by` e-mailje nem publikálhatja ugyanazt a dokumentumot. `false` vagy `0`: ugyanaz a user publikálhat. Üres `entered_by` nem blokkol.

A szerepet a user rekordról töltsd, `role` populate-tal. A JWT-ben lévő id önmagában nem elég, ha a role nincs a state-en. Admin, seed és user nélküli hívás `null`.

A REST API `status` nélkül publishedet ír. Az SPA ezért `?status=draft` queryt küld. A middleware-ben a hiányzó `params.status` nem publish: a Document Service alapja a draft. Csak a `published` és a `publish` / `unpublish` action tiltott.

A kapcsolt receipt-ek automatikus publishje a különböző-ember szabályt nem futtatja újra.

Ugyanebben a middleware-ben, a publish döntés után, ha a hívás mehet tovább:

- `create`: `entered_by` a Content user e-mailje. A body-ból jövő `entered_by` és `published_by` nem számít.
- `publish`, vagy create/update `status === 'published'` az `editor` szerepnél: `published_by` az `editor` e-mailje.
- `unpublish`: `published_by` üres.
- `update`: a body `entered_by` és `published_by` mezőjét dobd el, a tárolt rögzítő marad.

Admin, seed és user nélküli hívásnál az audit mezőt ne írd felül.

Az `editor` publish után a tranzakció minden kapcsolt receiptje published legyen, különben a published transaction populate üres receipts tömböt ad. Az őr az `editor`-nak mindkét uid-ot engedi.

Ne a member lifecycle mintát másold. Az entityService lifecycle nem látja megbízhatóan a `publish()` actiont.

## Szerepek

Idempotens ensure a `src/index.ts` `bootstrap({ strapi })` függvényében. Productionben is fusson. A `database/seeders/initial-data.js` productionben kilép, oda ne tedd a szerepeket.

`plugin::users-permissions.role` `type` értéke: `dataentry` és `editor`. Ha a `type` már létezik, ne hozz létre másodikat. Ha `editor` nincs, de `qa` igen, a meglévő sort nevezd át (`name`, `type`, `description`); a permission a role id-n marad. Ha `editor` már van, a `qa` sort hagyd. A permission sorokat az aktuális action-listából vedd:

`strapi.plugin('users-permissions').service('users-permissions').getActions()`.

Engedélyezendő actionök, ha a listában szerepelnek:

| Szerep | Action |
| --- | --- |
| mindkettő | `api::transaction.transaction.find`, `findOne`, `create`, `update` |
| mindkettő | `api::receipt.receipt.find`, `findOne`, `create`, `update` |
| mindkettő | `api::organization.organization.find`, `findOne` |
| mindkettő | `api::account.account.find`, `findOne` |
| mindkettő | `api::currency-type.currency-type.find`, `findOne` |
| mindkettő | `api::receipt-type.receipt-type.find`, `findOne` |
| mindkettő | a content-api upload action (`plugin::upload.content-api.upload`, ha a getActions így hívja) |
| mindkettő | `plugin::users-permissions.user.me` (a saját profil; user find/create/update/delete nincs) |

A Content API sanitize leveszi a `role` relációt, ha nincs `role.find`. Azt ne add ki: a `GET /roles` a szereplistát nyitná meg. A `src/extensions/users-permissions/strapi-server.ts` a `/api/users/me` válaszba a hívó saját role-ját teszi vissza (`type` a `ctx.state.user.role`-ból).

Delete, users-permissions user admin és az upload destroy kimarad. A publishhez nincs külön action: az őr dönt.

A permission rekord a `plugin::users-permissions.permission` query, `action` + `role`. Ismételt bootstrap ne duplikálja a sort.

## Google

A `config/plugins.ts` users-permissions config `grant.google` blokkja: `enabled: true`, `key` és `secret` az envből (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). A provider callback a Strapi host `/api/connect/google/callback` útvonala. A Google konzol redirectjei ezt és a `https://kor.fejlesztesek.hu/backoffice` SPA-t tartalmazzák. Titkot ne írj a fájlba.

## Ellenőrzés

Content API JWT-vel, nem Admin tokennel:

- `dataentry` `POST /api/transactions` status nélkül vagy `?status=published`: 403, a dokumentum nem published.
- `dataentry` `POST /api/transactions?status=draft`: 200, draft. Dátum, összeg, pénznem és leírás mellett üres szervezet és üres számlák 200. Csak leírás: 400.
- `editor` publish hiányos tárolt drafton (üres szervezet vagy számla): 400, a dokumentum nem published.
- `editor` publish: a transaction `status=published`, a `published_by` az `editor` e-mailje. A tranzakció minden kapcsolt receiptjének published verziója is létezik.
- `dataentry` draft create: az `entered_by` a belépett e-mail, akkor is, ha a body más értéket küld.
- A séma `vendor` nélkül is ment receiptet. Fájl csatolásakor a felület az eladót és a típust megköveteli.
- Admin Content Manager publish továbbra is működik.
