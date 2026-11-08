# Cloud agent prompt: Audit log v1 (Strapi HTTP middleware)

A **Feladat** szekciótól a fájl végéig kell bemásolni a felhő agentnek, de az egész fájl is mehet. Az agent dolgozzon külön branchen, ne force-pusholjon, és ne commitoljon secretet (`.env`, `.env.e2e`, token, `http-client.private.env.json`).

Előfeltétel: a [docs/plans/0004-audit-log.md](../plans/0004-audit-log.md) és a [docs/adr/0002-audit-log.md](../adr/0002-audit-log.md) legyen pusholva arra az ágra, amelyből az agent indul.

## Feladat

Valósítsd meg a Strapi audit log v1-et a `docs/plans/0004-audit-log.md` terv szerint.

## Olvasd el előtte

- `docs/plans/0004-audit-log.md`: ez a végrehajtandó terv, lépésről lépésre kövesd.
- `docs/adr/0002-audit-log.md`: a döntés indoklása.
- `src/publish-guard.ts`: minta az actor-feloldásra és a `strapi.db.query` használatára.
- `config/middlewares.ts`, `config/server.ts`, `src/index.ts`.
- `CLAUDE.md`, ha van.

## Scope

- Csak a terv 1–7. lépése tartozik bele. A „V2 javaslat (D opció)” szekciót **ne** valósítsd meg.
- Új npm függőséget ne vegyél fel.
- A Human jelölőnégyzeteket **ne** pipáld ki, azokat a fejlesztő ellenőrzi.
- A terv „álljon meg a Human sor előtt” szabálya erre a futásra **nem** érvényes: mind a 7 lépést egy menetben végezd el.
- Minden lépés után futtasd le a lépéshez tartozó ellenőrzést, és csak akkor lépj tovább, ha zöld.
- Ha egy ellenőrzés nem javítható meg, állj meg, és írd le, mi bukott el és miért.

## Kötelező szabályok

- Az audit soha nem törhet el üzleti kérést. A sink minden hibáját nyeld el, és `strapi.log.warn`-nal logold.
- Az `audit-log` content type-ot csak `strapi.db.query` írja, a Document Service-t ne használd hozzá.
- A users-permissions szerepkörök ne kapjanak jogot az `audit-log`-ra.
- A jelszó- és tokenmezők a body-ban és a query-ben is redaktálva legyenek, jwt pedig sehol ne kerüljön tárolásra.
- A middleware a `config/middlewares.ts`-ben a `strapi::body` után és a `strapi::session` előtt legyen.

## Ellenőrzés a végén

- `npx prettier --check .`
- `npm run typecheck` (ha nincs ilyen script, akkor `tsc`)
- `npm test`
- `npm run build`
- Smoke teszt: indítsd el a Strapit sqlite-tal (`npm run develop`), és curl-lel ellenőrizd az alábbiakat:
  1. `POST /api/auth/local` rossz jelszóval → keletkezik audit sor `status=400`, `actor_type=anonymous` és redaktált jelszó értékkel.
  2. Sikeres login, majd egy írási kérés → keletkezik audit sor `actor_type=user` értékkel, és a válaszban ott van az `X-Request-Id` header.
  3. `GET /api/audit-logs` JWT-vel → 403.

  Ha a bootstrap seederek miatt a smoke teszt nem futtatható, írd le, hol akadt el.

## Kimenet

- Új ág: `feat/audit-log-v1`.
- Conventional commitok, lépésenként egy-egy.
- Draft PR a `main` ágra, a leírásban:
  - lépésenként: mi készült el, és mi lett az ellenőrzés eredménye;
  - eltérések a tervtől, indoklással;
  - nyitott kérdések.
- A terv `**Status:**` mezőjét állítsd erre: `in progress (v1 implemented; Human verification pending)`.
