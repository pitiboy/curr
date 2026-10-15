# Content backoffice

A statikus SPA a Strapi `public/backoffice` mappájában van. A `strapi::public` middleware a `https://kor.fejlesztesek.hu/backoffice/` útvonalon adja. CI pipeline nincs.

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
