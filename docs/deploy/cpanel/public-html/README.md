# public_html wake + hibaoldal átirányítás

Ha a Passenger alatt alvó Node app közben frissítesz (`/backoffice/…`), a proxy gyakran **502/503/504** hibaoldalt ad — nem a wake landinget. A cPanel **Error Pages** vagy az alábbi **ErrorDocument** szabály a **gyökérre** (`/`) irányít, ahol a statikus `index.html` azonnal elindítja a `/api/wake` mechanizmust.

## Fájlok

| Fájl                | Szerep                                                             |
| ------------------- | ------------------------------------------------------------------ |
| `index.html`        | Wake landing a **site rooton** (hibaoldal redirect célja)          |
| `wake/index.html`   | Ugyanaz a lap a `/wake/` útvonalon (régi könyvjelzők)              |
| `.htaccess.example` | Apache szabályok — másold `.htaccess` néven a public_html gyökérbe |

A HTML forrása egy helyen van: `docs/deploy/wake/index.html`. Frissítés:

```bash
bash scripts/sync-wake-public-html.sh
```

## Telepítés (kor.fejlesztesek.hu)

1. Futtasd a sync scriptet (fent).
2. FTP-vel másold a `docs/deploy/cpanel/public-html/` tartalmát a domain **dokumentum gyökerébe** (cPanel „Document Root”, gyakran `public_html` a subdomain alatt — **nem** a `kor-szupatak` Node app mappa).
3. A `.htaccess.example` tartalmát tedd `.htaccess`-be, vagy a cPanel **Error Pages** felületen állítsd be:
   - **502 Bad Gateway**, **503 Service Unavailable**, **504 Gateway Timeout** → _Redirect the URL to this website_ → `/`
4. Ha a gyökér `index.html` továbbra is Passengerhez megy, kapcsold ki a fájlra a Passengert (a példa `.htaccess` kommentjei), vagy használd csak a `/wake/` útvonalat és Error redirectet: `/wake/?next=/backoffice/`.

## Visszatérési útvonal

A backoffice SPA minden betöltéskor elmenti a session storage-be (`kor-wake-next`), hogy ha a hibaoldal **nem** ad `?next=` paramétert, a wake oldal vissza tudja tenni a felhasználót arra a `/backoffice/…` útvonalra, ahol volt.

## Együttműködés a `PUBLIC_HOME_REDIRECT`-tel

Élesen a Node app env-ben maradhat a `PUBLIC_HOME_REDIRECT=/backoffice/`: ez a **működő** app gyökerét viszi tovább. A hibaoldal átirányítás csak akkor fut, ha a proxy/Passenger hibát ad; akkor a statikus `index.html` veszi át a szerepet.

Részletek: [wake-page.md](../wake-page.md).
