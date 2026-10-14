# content-backoffice

Szervezeti kiadás-rögzítő SPA (Vite + React Admin 5). A Strapi app a repo gyökerében marad.

## Futtatás

A gyökérből, miután ebben a mappában lefutott az `npm install`:

```bash
cp apps/content-backoffice/.env.example apps/content-backoffice/.env
npx nx dev content-backoffice
```

A keret: [http://localhost:5173/backoffice/](http://localhost:5173/backoffice/). A Vite `base` a `/backoffice/`. `VITE_STRAPI_URL` a Strapi origin, path nélkül (`http://localhost:1337` lokálisan); az API bekötés a 3. lépés.

```bash
npx nx build content-backoffice
```
