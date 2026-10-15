# Google OAuth a content-backoffice SPA-hoz

A Users & Permissions Google provider a `GOOGLE_CLIENT_ID` és `GOOGLE_CLIENT_SECRET` env kulcsokat olvassa. Az értékek nem a repóban vannak.

A Google Cloud Console authorized redirect URI listája:

- a Strapi host `/api/connect/google/callback` útvonala (lokálisan `http://localhost:1337/api/connect/google/callback`, élesen `https://kor.fejlesztesek.hu/api/connect/google/callback`)
- a SPA: `https://kor.fejlesztesek.hu/backoffice`

A Strapi admin Users & Permissions → Providers → Google „redirect URL to your front-end app” mezője is a SPA címe: `https://kor.fejlesztesek.hu/backoffice`. Fejlesztéshez `http://localhost:5173/backoffice/`.

A login gomb a `/api/connect/google` flow-t indítja. A visszakapott Content JWT a `strapi_jwt` kulcsra kerül, ugyanoda, ahová a local login.
