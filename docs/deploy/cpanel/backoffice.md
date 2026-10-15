# Content backoffice SPA a `/backoffice` pathon

A Vite app `apps/content-backoffice`. A `base` a `/backoffice/`. Az éles API ugyanaz az origin: `https://kor.fejlesztesek.hu`. CI pipeline nincs. A feltöltést a Human indítja, helyi adatbázis és helyi user nem megy ki.

A Strapi FTP mintája változatlan: `deploy`, `deploy:kor.fejlesztesek.hu`, `scripts/ftp-deploy.sh`, `.env.deploy:kor.fejlesztesek.hu`. Az SPA ugyanerre a fájlra és scriptre épül, `--spa` kapcsolóval.

## Mit hova

| Lépés | Parancs | Eredmény |
| --- | --- | --- |
| Build | `npm run _predeploy:f:kor.fejlesztesek.hu` | `apps/content-backoffice/dist`, `VITE_STRAPI_URL=https://kor.fejlesztesek.hu` |
| Feltöltés | `npm run deploy:f` | A `dist` a `kor-szupatak/public/backoffice` mappába megy |
| URL | — | `https://kor.fejlesztesek.hu/backoffice/` |

A `strapi::public` a `public/` tartalmát a host gyökerén szolgálja, ezért a távoli `public/backoffice` a `/backoffice` path. A gyökér `package.json` nem kap React Admin függőséget; az SPA saját `node_modules` az `apps/content-backoffice` alatt.

## Előkészítés

1. Az SPA csomagok: `npm ci` az `apps/content-backoffice` mappában, ha még nincs `node_modules`.
2. A titkos env: másold a gyökér `.env.deploy.example` fájlt `.env.deploy:kor.fejlesztesek.hu` néven, és töltsd ki az `FTP_PASS` értékét. Ugyanez a fájl a Strapi `npm run deploy` parancsáé.
3. Opcionális: `FTP_BACKOFFICE_REMOTE_DIR` (alap `kor-szupatak/public/backoffice`).

## Feltöltés

```bash
npm run _predeploy:f:kor.fejlesztesek.hu
npm run deploy:f
```

A `deploy:f` a host-specifikus `deploy:f:kor.fejlesztesek.hu` aliasa. Az a script a buildet is lefuttatja, utána `bash scripts/ftp-deploy.sh .env.deploy:kor.fejlesztesek.hu --spa`. Dry-run: ugyanaz `--dry-run` kapcsolóval a scripten.

A `public/uploads` és a szerver `.env` nem változik. Statikus fájl, Strapi újraindítás és NPM Install nem kell. A fejlesztés alatti sqlite/Neon adat és a helyi Content userek az éles bázisba nem kerülnek.

## Ellenőrzés

A `https://kor.fejlesztesek.hu/backoffice/` betölt. Az assetek `/backoffice/` prefixszel jönnek. A login a host `/api` végpontjait hívja, nem a `localhost:1337`-et.
