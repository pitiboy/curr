# Content backoffice — Google OAuth (deploy)

Részletes folyamat (Strapi provider + SPA + admin / regisztráció): [content-backoffice-oauth.md](../content-backoffice-oauth.md).

A backoffice SPA Google belépése a Strapi Users & Permissions `google` providerén megy. A kliens azonosító és titok csak környezeti változó (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), nem kerül a repóba.

## Google Cloud Console

### OAuth kliens (Client ID és secret)

Helye: [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients) (régen: APIs & Services → Credentials). Fent a projektválasztóban ugyanaz a projekt legyen, amelyikben a Branding is van.

1. **Create client** (vagy a meglévő megnyitása), típus: **Web application**. A Google-lel a Strapi szerver beszél (ő kapja a callbacket és ő használja a secretet), ezért webes kliens kell. Az SPA-nak nem kell külön kliens.
2. **Authorised JavaScript origins**: nem kell, a böngésző nem hívja közvetlenül a Google-t.
3. **Authorised redirect URIs**: lásd lent (Strapi `/api/connect/google/callback`).
4. Mentés után a **Client ID** és a **Client secret** a kor környezeti változóiba megy: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. A secretet a Google csak létrehozáskor mutatja teljesen, ott másold ki; ha elveszett, a kliens oldalán generálható új.

### Audience (publikálás)

[Google Auth Platform → Audience](https://console.cloud.google.com/auth/audience): ha a Publishing status **Testing**, csak a *Test users* listán szereplő fiókok tudnak belépni. Vagy vedd fel őket, vagy **Publish app**. Csak `email` scope mellett nincs hosszú ellenőrzés, legfeljebb a branding (logó) miatt.

### Redirect URI

Authorized redirect URI (Strapi host):

- Éles: `https://kor.fejlesztesek.hu/api/connect/google/callback`
- Lokál: `http://localhost:1337/api/connect/google/callback`

A Strapi `PUBLIC_URL` mezőjének originje egyezzen a fenti hosttal.

### OAuth consent screen (Branding)

| Mező | Érték |
| --- | --- |
| Application home page | `https://kor.fejlesztesek.hu/legal/about` (vagy `https://kor.fejlesztesek.hu`, ha a `PUBLIC_HOME_REDIRECT=/legal/about` be van állítva, lásd lent) |
| Application privacy policy link | `https://kor.fejlesztesek.hu/legal/privacy-policy` |
| Application terms of service link | `https://kor.fejlesztesek.hu/legal/terms-of-service` |
| Authorised domains | `fejlesztesek.hu` |

Az **Authorised domains** listába a `fejlesztesek.hu` kerüljön (a legfelső szintű, regisztrálható domain, nem a `kor.` aldomain). Enélkül a konzol pirossal jelzi a home page, privacy és terms linkeket, és a redirect URI-t sem fogadja el.

Scope: csak `email` (a Strapi Google provider alapértéke). Nem érzékeny scope, így a Google-ellenőrzés csak a branding (logó, home page) miatt lehet szükséges.

A jogi oldalak a Strapi `legal-page` gyűjteményéből jönnek, belépés nélkül, mindig az aktuális adatbázis-tartalommal (`src/legal-pages.ts`):

- Lista: `https://kor.fejlesztesek.hu/legal`
- Oldal: `https://kor.fejlesztesek.hu/legal/{slug}` (magyar, alapértelmezett), `…/legal/{slug}?locale=en` (angol; ha nincs angol bejegyzés, a magyar jelenik meg)
- JSON: `GET /api/legal-pages?locale=hu|en` (public role: `find`, `findOne`; a bootstrap adja meg)

A Google konzolba a paraméter nélküli (magyar) címeket írd; mindegyik oldal fejlécében HU / EN váltó van, így a Google ellenőrzője az angol változatot is eléri.

A szövegek forrása és a feltöltés lépései: [docs/legal/README.md](../legal/README.md). A Google konzolba csak akkor írd be a linkeket, ha a bejegyzések (`about`, `privacy-policy`, `terms-of-service`) már fent vannak, különben 404-et kap a Google.

### Kezdőlap

A `legal-page` `about` bejegyzése a KÖR nyilvános bemutató oldala (mit csinál az alkalmazás, miért kéri az e-mail címet, linkek a tájékoztatóra). A gyökér alapból a kezelő felületre (`/backoffice/`) irányít.

- **Ajánlott (Google konzol):** Application home page = `https://kor.fejlesztesek.hu/legal/about`. Nincs szerveroldali teendő.
- **Opcionális:** a kor alkalmazás cPanel env-jében `PUBLIC_HOME_REDIRECT=/legal/about`, újraindítás. Ekkor `https://kor.fejlesztesek.hu/` → 302 → `/legal/about`, és a home page mezőbe a gyökér is mehet. Csak relatív, `/`-rel kezdődő utat fogad el. Ne a közös `.env`-be tedd, mert az aliasok örökölnék.

Linkek a felületeken:

- Backoffice SPA: a login oldalon a Google gomb alatt (alatta nyelvválasztó), belépés után a tartalom alján lévő láblécben. A kiválasztott felületnyelv szerinti oldalra mutat.
- Strapi Admin: a bejelentkező képernyő jobb felső sarkában **+ Kezelő felület** gomb a `/backoffice/`-ra; kis, rögzített lábléc alul középen (login és belépés után is), `src/admin/app.tsx`. Az admin nyelvét követi (magyar admin → magyar oldal, minden más → `?locale=en`).

## Strapi grant

A `config/plugins.ts` és a bootstrap a grant tárolót tölti: `enabled`, `key`, `secret`, valamint a front-end visszatérési URL (`BACKOFFICE_OAUTH_CALLBACK`, alapból `http://localhost:5173/backoffice/`). Élesben állítsd `https://kor.fejlesztesek.hu/backoffice/`-ra.

## SPA flow

1. Login: `GET {STRAPI}/api/connect/google?callback={encodeURIComponent(SPA /backoffice/ URL)}`
2. Google vissza a Strapi `/api/connect/google/callback` címére.
3. Strapi átirányít a megadott SPA callbackre; a login oldal `GET /api/auth/google/callback` hívással (session cookie) JWT-t kap, és ugyanabba a `localStorage` kulcsba menti, mint a local login.

Éles értékek: a Google konzol redirect URI-ja a Strapi callback (`https://kor.fejlesztesek.hu/api/connect/google/callback`), a grant `callback` mezője (`BACKOFFICE_OAUTH_CALLBACK`) pedig az SPA címe (`https://kor.fejlesztesek.hu/backoffice/`). A kettő nem ugyanaz.
