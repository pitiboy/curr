# ADR 0002: Audit log endpoint szinten, saját Koa middleware-rel

**Status:** accepted
**Date:** 2026-11-08
**Implementációs terv:** [0004-audit-log](../plans/0004-audit-log.md)

## Context

Eddig az audit csak a `transaction` és a `receipt` `entered_by` / `published_by` mezőiből állt ([ADR 0001](./0001-react-admin-content-ui.md), [`src/publish-guard.ts`](../../src/publish-guard.ts)). Nem látszik, ki melyik endpointot hívta, mit küldött, és mi lett az eredmény.

A backoffice (react-admin, `ra-strapi`) kizárólag REST-en, users-permissions JWT-vel hívja a Strapit. Az admin panel a `/admin/*` és a `/content-manager/*` útvonalakon ír.

Környezeti megkötések:

- A prod cPanel + Phusion Passenger, FTP-s deployjal. Nincs Docker, nincs log-aggregátor, és a stdout a Passenger logba megy.
- Prodban Postgres fut, devben és e2e-ben sqlite is lehet.
- Vannak többírásos endpointok (`/api/transaction-workflows/convert`, `discardDraft`).

Követelmény: egyszerű, robusztus, megbízható és env-ből könnyen állítható megoldás.

## Decision

Egy **saját globális Koa middleware** (`global::audit-log`) minden releváns HTTP kérésről egy sort ír:

- **Sink:** az alapérték `both`. Az `audit-log` content type tábla az elsődleges, kereshető tároló. Mellette strukturált pino JSON sor kerül a stdoutra.
- **Hatókör:** a `/api/`, `/admin/` és `/content-manager/` prefixek alatt, az írási metódusoknál. A login endpointok (`/api/auth/local`, `/admin/login`, Google callback stb.) mindig naplózódnak, a sikertelen kísérletek is.
- **Redakció:** jelszó- és token-kulcsok rekurzívan, a body-ban és a query-ben is. A body mérete limitált.
- Minden kapcsoló `AUDIT_LOG_*` env-ből jön. A retenciót egy napi Strapi cron végzi.
- Az írás `strapi.db.query`-vel történik (a Document Service megkerülésével), a válasz előtt `await`-elve. Minden audit-hibát el kell nyelni, a kérés sosem törhet el miatta.

A dokumentum-szintű audit (`strapi.documents.use`, előtte/utána diff, nem-HTTP írások) **V2 javaslat**, lásd a [terv V2 szekcióját](../plans/0004-audit-log.md#v2-javaslat-document-service-audit-d-opció).

## Elvetett opciók

| Opció                                             | Ok                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Strapi Enterprise Audit Logs                      | fizetős, és csak az admin panelt fedi, a content API-t (backoffice) nem                         |
| Community plugin                                  | Strapi 5.58-on bizonytalan a karbantartottsága, és frissítési lock-int okozna                   |
| `strapi.db.lifecycles.subscribe`                  | bulk és raw query esetén lyukas, nehéz hozzáférni az actorhoz                                   |
| Postgres trigger / pgaudit                        | nincs app-szintű actor, sqlite-on nem fut, cPanel-en DB-admin jog kellene                       |
| Proxy / Apache access log                         | nincs actor és body, cPanel-en nem kontrollálható                                               |
| Külső SaaS (Better Stack, Axiom stb.) közvetlenül | havidíj és adatkivitel (GDPR). A stdout sink miatt később változtatás nélkül rácsatlakoztatható |

## 12-faktoros szempontok

- **III. Config:** minden beállítás env-ből jön (`AUDIT_LOG_*`), alapértékekkel, és dokumentálva van a `.env.example`-ben.
- **IV. Backing services:** az audit tároló csatolt erőforrás. Ma ez a meglévő DB, később külön DB vagy SaaS lehet.
- **VI. Stateless processes:** nincs helyi logfájl, ami Passengeren és FTP-deploynál úgyis elveszne.
- **IX. Disposability:** a sor írása a válasz előtt `await`-elt, így restartkor nem vész el. A hibát a sink elnyeli.
- **X. Dev/prod parity:** a `strapi.db.query` sqlite-on és Postgresen is ugyanúgy fut.
- **XI. Logs as event streams:** itt feszültség van, mert az audit üzleti adat (kereshető, megőrzendő), nem csak log. Feloldás: a DB az elsődleges, és a stdout stream mellette párhuzamosan fut (`both`).
- **XII. Admin processes:** a retenciós purge egy idempotens cron task.

## Consequences

- Minden írási kérés egy plusz INSERT-tel jár (~1–3 ms). Ez elfogadható.
- Az audit tábla nő, ezért a retenciót be kell állítani (alapérték: 365 nap).
- A tábla az admin panelen szerkeszthető. Ha manipulációvédelem kell, azt RBAC-cal vagy a V2-ben kell kezelni.
- Új, érzékeny mezőt tartalmazó endpoint bevezetésekor a redakciós listát is át kell nézni.
