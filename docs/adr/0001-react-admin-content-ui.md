# ADR 0001: React Admin 5 a Strapi tartalom kezelésére

**Status:** accepted  
**Date:** 2026-10-12  
**Deciders:** a tartalomkezelő SPA react-admin 5-re épül.

## Context

A backend Strapi **5.27** ([package.json](../../package.json)). A Content API REST; GraphQL plugin nincs. Tizenkét collection type él az [`src/api/`](../../src/api/) alatt: `account`, `account-category`, `currency-category`, `currency-rate`, `currency-type`, `member`, `membership`, `membership-type`, `organization`, `receipt`, `transaction`, `transaction-type`.

A mezők: `string`, `text`, `uid`, `email`, `decimal`, `date`, `datetime`, `enumeration`, `media`, `relation`. Komponens, dynamic zone, blocks és richtext nincs. `draftAndPublish` csak a `transaction` és a `receipt` típuson igaz. Média mező a bizonylaton van, Cloudinary-n ([config/plugins.ts](../../config/plugins.ts)). Auth a Users & Permissions plugin (`/api/auth/local`), nem a Strapi admin JWT.

A Strapi Content Manager megmarad fejlesztői felületnek. A szervezetkezelőknek külön React SPA kell, ami a REST API-n olvas és ír, kevés kézi mezőkonfigurációval, és a képernyők később resourceonként cserélhetők.

## Decision

A SPA **react-admin 5** és a **`ra-strapi`** data/auth provider. Külön Vite + React alkalmazás a Strapi admin mellé; a Strapi saját admin Reactjébe nem kerül bele.

### Adatkapcsolat

- `strapiAuthProvider`, `strapiHttpClient`, `strapiDataProvider` a Strapi URL-re.
- Bejelentkezés: `loginPage={LoginWithEmail}`.
- Users & Permissions szerep, ami a kezelt collection type-okra kap find, create, update és delete jogot.
- A Strapi 5 a get, update és delete pathban `documentId`-t vár. A react-admin rekord `id` mezője ez a string. Ha az `ra-strapi` a numerikus `id`-t adja tovább, egy vékony wrapper állítja `id = documentId`-ra.

### Séma, típusok, képernyők

A forrás az `src/api/**/content-types/**/schema.json`. Egy rövid fordító két fájlt ír az admin appba.

Resource katalógus, ebből rajzol a felület:

- `name`: a `pluralName`, ez a REST path (például `members`)
- `label`: `info.displayName`; mezőnként a `metadatas.label` (Név, Számla, …)
- `draftAndPublish`
- mező: `kind`, `required`, `enum`; relációnál a kapcsolat típusa és a cél `pluralName`
- `mappedBy` inverz reláció csak show nézeten jelenik meg
- `createdBy`, `updatedBy`, `locale`, `localizations` kimarad
- egy szint `populate` a reláció- és média mezőkre, hogy a `ReferenceField` kapjon címkét

REST interfészek ugyanebből a futásból: `documentId: string`, skalár mezők a séma szerint, reláció egy szint mélyen `{ documentId: string } | null`.

Egy `SchemaList`, `SchemaEdit` és `SchemaShow` olvassa a katalógust:

| Strapi típus      | react-admin  |
| ----------------- | ------------ |
| string, text, uid | Text         |
| email             | Email        |
| decimal           | Number       |
| date, datetime    | Date         |
| enumeration       | Select       |
| relation          | Reference    |
| media             | Image / fájl |

Későbbi egyedi képernyő resourceonként felülírja a generált nézetet. A katalógus a widgetektől független adat: a Material UI téma, a layout és az egyes List/Edit/Show komponensek cseréje nem írja újra a sémát.

A `ListGuesser`, `EditGuesser` és `ShowGuesser` csak az első ellenőrzésre való. Egy élő rekordból találgatnak; üres listán, null reláción és minta nélküli enumon mezők tűnnek el. A react-admin dokumentáció production képernyőnek nem ajánlja őket.

A `strapi ts:generate-types` marad a Strapi szervernek (`types/generated/`). A frontend fordító a `schema.json`-t olvassa, a generált `.d.ts` fájlt nem parse-olja.

### Ismert határok

Az `ra-strapi` 1.0.3 (2025 március) ezeket még nem fedi le teljesen:

- média feltöltés és csere (a `receipt` dokumentum mező)
- egynél mélyebb `populate`
- a Users & Permissions jogosultságlista bekötése az `authProvider.getPermissions`-be

A haladó RBAC és a realtime a react-admin Enterprise csomagjában van. Az első verzió ezek nélkül készül: a jogosultságot a Strapi szerep adja. Az Enterprise audit log kimarad. A v1 saját auditja a transaction és a receipt `entered_by` / `published_by` stringje, amit a szerver ír; a generált katalógus a Strapi `createdBy` / `updatedBy` admin relációt továbbra sem rajzolja ki.

## Consequences

- Új collection type vagy mező a `schema.json` változása után egy generálással bekerül a listába és az űrlapba.
- A relációk, a kötelezőség, az enumok és a magyar címkék a sémából jönnek, nem egy minta rekordból.
- A felület Material UI. A paletta, a sűrűség, a sötét mód és a resourceonkénti komponenscsere a testreszabás útja.
- A bizonylat média mezője és a `transaction` / `receipt` draft állapot külön figyelmet kér az első bekötésnél, mert a provider ezeken lyukas.
- A Strapi admin és ez a SPA egymás mellett él: a fejlesztői Content Manager megmarad, a kezelői felület a REST API-n és a Users & Permissions szerepen keresztül dolgozik.
