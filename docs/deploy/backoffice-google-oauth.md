# Content backoffice — Google OAuth (deploy)

Részletes folyamat (Strapi provider + SPA + admin / regisztráció): [content-backoffice-oauth.md](../content-backoffice-oauth.md).

A backoffice SPA Google belépése a Strapi Users & Permissions `google` providerén megy. A kliens azonosító és titok csak környezeti változó (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), nem kerül a repóba.

## Google Cloud Console

Authorized redirect URI (Strapi host):

- Éles: `https://kor.fejlesztesek.hu/api/connect/google/callback`
- Lokál: `http://localhost:1337/api/connect/google/callback`

A Strapi `PUBLIC_URL` mezőjének originje egyezzen a fenti hosttal.

## Strapi grant

A `config/plugins.ts` és a bootstrap a grant tárolót tölti: `enabled`, `key`, `secret`, valamint a front-end visszatérési URL (`BACKOFFICE_OAUTH_CALLBACK`, alapból `http://localhost:5173/backoffice/`). Élesben állítsd `https://kor.fejlesztesek.hu/backoffice/`-ra.

## SPA flow

1. Login: `GET {STRAPI}/api/connect/google?callback={encodeURIComponent(SPA /backoffice/ URL)}`
2. Google vissza a Strapi `/api/connect/google/callback` címére.
3. Strapi átirányít a megadott SPA callbackre; a login oldal `GET /api/auth/google/callback` hívással (session cookie) JWT-t kap, és ugyanabba a `localStorage` kulcsba menti, mint a local login.

Éles redirect a Google konzolban és a grant `callback` mezőben: `https://kor.fejlesztesek.hu/backoffice`.
