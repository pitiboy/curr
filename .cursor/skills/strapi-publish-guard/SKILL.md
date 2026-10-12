---
name: strapi-publish-guard
description: >-
  Enforces Strapi 5.27 draft versus publish for transaction and receipt,
  seeds the dataentry and qa Users & Permissions roles, makes receipt.vendor
  optional, and configures the Google provider. Use when editing draft and
  publish, Users & Permissions roles, the receipt schema, src/index.ts
  bootstrap, or the Google grant in config/plugins.ts.
---

# Strapi publish őr

A követelmény a `docs/prd/0001-content-backoffice-v1.md` §9. Ez a skill a repo útját rögzíti. Strapi **5.27**. A transactionnek nincs saját route-ja; a receipt route és controller gyári factory. Új policy fájlt a gyári routerre ne tegyél: a Document Service middleware minden REST írást lát.

## Séma

A `src/api/receipt/content-types/receipt/schema.json` fájlban a `vendor` `required` mezője legyen `false`. A `document` maradjon `required: true`. A `description` required marad. A `transaction.receipt` reláció maradjon opcionális `manyToOne`.

Más content type `draftAndPublish` értéke nem változik.

## Middleware

A `src/index.ts` `register({ strapi })` törzsében, a meglévő proxy middleware mellett:

```ts
import { errors } from '@strapi/utils';

const GUARDED = ['api::transaction.transaction', 'api::receipt.receipt'];

strapi.documents.use(async (context, next) => {
  if (!GUARDED.includes(context.uid)) return next();

  const roleType = await contentApiRoleType(strapi);
  if (roleType === null || roleType === 'qa') return next();

  const publishing =
    context.action === 'publish' ||
    context.action === 'unpublish' ||
    ((context.action === 'create' || context.action === 'update') &&
      context.params?.status === 'published');

  if (publishing) {
    throw new errors.ForbiddenError(
      'Only the qa role can publish transactions and receipts'
    );
  }

  return next();
});
```

`contentApiRoleType` csak akkor ad vissza szerep-`type` stringet, ha a kérés users-permissions stratégiájú. Admin, seed és user nélküli hívás `null`. A szerepet a user rekordról töltsd, `role` populate-tal; a JWT-ben lévő id önmagában nem elég, ha a role nincs a state-en.

A REST API `status` nélkül publishedet ír. Az SPA ezért `?status=draft` queryt küld. A middleware-ben a hiányzó `params.status` nem publish: a Document Service alapja a draft. Csak a `published` és a `publish` / `unpublish` action tiltott.

A `qa` publish után a kapcsolt receipt is published legyen, különben a published transaction populate üres receiptet ad. Az őr a `qa`-nak mindkét uid-ot engedi.

Ne a member lifecycle mintát másold. Az entityService lifecycle nem látja megbízhatóan a `publish()` actiont.

## Szerepek

Idempotens ensure a `src/index.ts` `bootstrap({ strapi })` függvényében. Productionben is fusson. A `database/seeders/initial-data.js` productionben kilép, oda ne tedd a szerepeket.

`plugin::users-permissions.role` `type` értéke: `dataentry` és `qa`. Ha a `type` már létezik, ne hozz létre másodikat. A permission sorokat az aktuális action-listából vedd:

`strapi.plugin('users-permissions').service('users-permissions').getActions()`.

Engedélyezendő actionök, ha a listában szerepelnek:

| Szerep | Action |
| --- | --- |
| mindkettő | `api::transaction.transaction.find`, `findOne`, `create`, `update` |
| mindkettő | `api::receipt.receipt.find`, `findOne`, `create`, `update` |
| mindkettő | `api::organization.organization.find`, `findOne` |
| mindkettő | `api::account.account.find`, `findOne` |
| mindkettő | a content-api upload action (`plugin::upload.content-api.upload`, ha a getActions így hívja) |

Delete, users-permissions user admin és az upload destroy kimarad. A publishhez nincs külön action: az őr dönt.

A permission rekord a `plugin::users-permissions.permission` query, `action` + `role`. Ismételt bootstrap ne duplikálja a sort.

## Google

A `config/plugins.ts` users-permissions config `grant.google` blokkja: `enabled: true`, `key` és `secret` az envből (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). A provider callback a Strapi host `/api/connect/google/callback` útvonala. A Google konzol redirectjei ezt és a `https://kor.fejlesztesek.hu/backoffice` SPA-t tartalmazzák. Titkot ne írj a fájlba.

## Ellenőrzés

Content API JWT-vel, nem Admin tokennel:

- `dataentry` `POST /api/transactions` status nélkül vagy `?status=published`: 403, a dokumentum nem published.
- `dataentry` `POST /api/transactions?status=draft`: 200, draft.
- `qa` publish: a transaction `status=published`. Receipttel együtt a receipt published verziója is létezik.
- `vendor` nélküli receipt `document` fájllal menthető.
- Admin Content Manager publish továbbra is működik.
