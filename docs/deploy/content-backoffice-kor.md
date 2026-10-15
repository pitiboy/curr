# Content backoffice — kor.fejlesztesek.hu

A React Admin SPA statikus fájljai a Strapi ugyanazon hostján, a `/backoffice` útvonal alatt futnak. Az API ugyanaz az origin (`https://kor.fejlesztesek.hu`), path nélkül a `VITE_STRAPI_URL`-ben.

CI pipeline nincs (v1). A feltöltés helyi FTPS-sel történik, a Strapi deploy mintájára.

## Előkészítés

1. Másold a gyökér `.env.deploy.example` backoffice szekcióját `.env.deploy:backoffice:kor.fejlesztesek.hu` néven.
2. Töltsd ki az `FTP_PASS` értékét (ugyanaz a cPanel FTP user, mint a Strapi deploynál).
3. Ellenőrizd: `VITE_STRAPI_URL=https://kor.fejlesztesek.hu` (nincs perjel a végén).

A Vite `base` értéke `/backoffice/` (`apps/content-backoffice/vite.config.ts`). A build kimenete az `apps/content-backoffice/dist` mappa.

A szerveren a cél a Strapi `public/backoffice` almappája (`node/kor-szupatak/public/backoffice`), ahonnan a Passenger/Strapi kiszolgálja a statikus fájlokat. Ezt a `BACKOFFICE_REMOTE_SUBPATH` env kulcs állítja (alapértelmezés: `public/backoffice`).

## Build és feltöltés

```bash
npm run deploy:backoffice
```

Ez lefuttatja a production buildet (`VITE_STRAPI_URL` az env fájlból), majd FTPS-sel feltölti a `dist` tartalmát. Csak száraz futtatás:

```bash
bash scripts/ftp-deploy-backoffice.sh .env.deploy:backoffice:kor.fejlesztesek.hu --dry-run
```

Strapi deploy ettől független: `npm run deploy` továbbra is a teljes Strapi fát tölti fel.

## Ellenőrzés

- Böngésző: `https://kor.fejlesztesek.hu/backoffice/` — magyar keret, login.
- Hálózat: az API hívások `https://kor.fejlesztesek.hu/api/...` címre mennek (ugyanaz az origin, CORS nélkül).

A helyi fejlesztői adat és userök nem kerülnek az éles adatbázisba; az éles Content userek a Strapi Adminban vannak.

## Kapcsolódó

- Strapi cPanel alias: [cpanel/alias/readme.md](./cpanel/alias/readme.md)
- Google OAuth callback (9. lépés): Strapi `/api/connect/google/callback`, redirect `https://kor.fejlesztesek.hu/backoffice`
