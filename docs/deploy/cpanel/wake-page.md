# Wake oldal (hidegindítás)

A Node alkalmazás (Strapi + backoffice) cPanel Passenger alatt hosszú inaktivitás után 30+ másodpercig nem válaszol. A `docs/deploy/wake/index.html` statikus oldal azonnal betölt, meghívja a `/api/wake` végpontot, majd progresszal vár, amíg az alkalmazás elérhető.

## Mit töltött fel a repó

| Fájl                          | Szerep                                         |
| ----------------------------- | ---------------------------------------------- |
| `docs/deploy/wake/index.html` | Statikus landing (nincs build lépés)           |
| `server/wake-entry.js`        | Production: HTTP azonnal, majd Strapi `load()` |
| `server.js`                   | Passenger belépési pont                        |

## Statikus oldal telepítése

1. Másold a `docs/deploy/wake/` mappát a domain **dokumentum gyökerébe** (cPanelen gyakran `public_html/wake/`), FTP-vel vagy Fájlkezelővel. Az oldal a Node app-tól függetlenül szolgálódik ki.
2. A látogatók URL-je: `https://<domain>/wake/?next=/backoffice/` — a `next` paraméter csak ugyanarra az originre mutató relatív útvonal lehet (open redirect védelem).
3. A Node app továbbra is a meglévő Strapi deploy útvonalon fut (`server.js` + `tmp/restart.txt`).

### Opcionális Apache / `.htaccess` (nem kötelező)

A kód **nem** függ ettől. Ha a várakozó oldalt szeretnéd a backoffice útvonal előtt megjeleníteni, az éles `public_html`-ben helyezhető el például:

```apache
# Opcionális: csak akkor, ha a wake HTML a public_html/wake alatt van.
# RewriteEngine On
# RewriteRule ^backoffice/?$ /wake/index.html?next=/backoffice/ [R=302,L,QSA]
```

Más hostingon (nginx, CDN) hasonló szabály opcionális — a wake oldal és az API önállóan is működik, ha a felhasználó közvetlenül a `/wake/` URL-re megy.

## API viselkedés

- `GET /api/wake` — azonnali `200`, `Cache-Control: no-store`, nincs auth, nincs DB.
- `GET /api/wake/ready` — `200` ha a Strapi betöltött; egyébként `503` + `Retry-After`.
- Passenger esetén a `server/wake-entry.js` **előbb** figyel a `PORT`-on, mint a Strapi `load()` befejeződne, ezért hidegindításkor is válaszol a wake.

### Korlátok

- A `/api/wake` csak akkor „azonnali”, ha a production `server.js` a `wake-entry` wrappert használja (`strapi start` / CLI közvetlenül nem).
- Amíg a Strapi bootstrap fut, a többi útvonal `503` (szándékosan).
- A statikus oldal a fő app elérhetőségét a `next` útvonal HEAD kérésével is ellenőrzi.

## Ellenőrzés

```bash
curl -sS -D - -o /dev/null http://127.0.0.1:1337/api/wake
curl -sS http://127.0.0.1:1337/api/wake/ready
```

Ref: GitHub issue #62.
