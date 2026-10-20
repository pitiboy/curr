# Content backoffice

A statikus SPA a Strapi `public/backoffice` mappájában van. A `strapi::public` middleware a `https://kor.fejlesztesek.hu/backoffice/` útvonalon adja. CI pipeline nincs.

## Gyökér (`/`) → backoffice

Alapból a Strapi a `/` címet az `/admin`-ra irányítja (`strapi::public` route). A `global::home-redirect` middleware ( `src/middlewares/home-redirect.ts` ) ezt felülírja: `https://kor.fejlesztesek.hu/` → `/backoffice/`.

**Élesen:** Strapi deploy + Passenger újraindítás kell (csak a backoffice FTP nem elég). Ellenőrzés:

```bash
curl -sI https://kor.fejlesztesek.hu/ | grep -i '^location:'
# location: https://kor.fejlesztesek.hu/backoffice/
```

Ha még mindig `/admin` jön, a régi `dist` fut, vagy a cPanel env-ben `PUBLIC_HOME_REDIRECT=` (üres) van — töröld, vagy állítsd `/backoffice/`-ra. Bemutató oldal gyökérhez: `PUBLIC_HOME_REDIRECT=/legal/about`.

A gyökérből:

```bash
npm run deploy:f
```

Ez lefuttatja a `build:f:kor.fejlesztesek.hu` scriptet, majd az FTP-t. A build beégeti a `VITE_STRAPI_URL=https://kor.fejlesztesek.hu` és a `VITE_APP_TITLE=KÖR` értéket. Az API ugyanaz az origin, path nélkül.

Az FTP ugyanaz a fájl, mint a Strapi deployé: `.env.deploy:kor.fejlesztesek.hu` (minta: `.env.deploy.example`). A távoli mappa `$FTP_REMOTE_DIR/public/backoffice`. A mirror törli onnan a buildből hiányzó régi fájlokat. A helyi adatbázis és a helyi userek nem mennek fel.

Feltöltés build nélkül, vagy próba:

```bash
bash scripts/ftp-deploy-backoffice.sh .env.deploy:kor.fejlesztesek.hu --dry-run
```

A `build:f` a helyi envvel buildel. Az éles origin csak a `build:f:kor.fejlesztesek.hu` scriptben van.
