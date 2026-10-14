# content-backoffice

Szervezeti kiadás-rögzítő SPA (Vite + React Admin 5 + `ra-strapi`). A Strapi app a repo gyökerében marad.

## Futtatás

A gyökérből, miután ebben a mappában lefutott az `npm install`:

```bash
cp apps/content-backoffice/.env.example apps/content-backoffice/.env
npx nx serve content-backoffice
```

A login héj: [http://localhost:8080/backoffice/](http://localhost:8080/backoffice/). A Vite `base` a `/backoffice/`. `VITE_STRAPI_URL` a Strapi origin, path nélkül (`http://localhost:1337` lokálisan).

```bash
npx nx build content-backoffice
npx nx typecheck content-backoffice
```
