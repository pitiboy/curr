# Jogi oldalak (legal-page)

A Google OAuth hozzájárulási képernyő (consent screen) kezdőlapot, adatkezelési tájékoztatót és felhasználási feltételeket kér. A szövegek a Strapi `legal-page` gyűjteményben élnek, két nyelven (i18n: `hu` alapértelmezett, `en`). A Strapi nyilvánosan, belépés nélkül szolgálja ki őket.

| Dokumentum | slug | `footer_order` | Forrás | Magyar (alap, a Google-nek ezt add meg) | Angol |
| --- | --- | --- | --- | --- | --- |
| Adatkezelési tájékoztató / Privacy Policy | `privacy-policy` | 1 | `hu/privacy-policy.md`, `en/privacy-policy.md` | https://kor.fejlesztesek.hu/legal/privacy-policy | https://kor.fejlesztesek.hu/legal/privacy-policy?locale=en |
| Felhasználási feltételek / Terms of Service | `terms-of-service` | 2 | `hu/terms-of-service.md`, `en/terms-of-service.md` | https://kor.fejlesztesek.hu/legal/terms-of-service | https://kor.fejlesztesek.hu/legal/terms-of-service?locale=en |
| A KÖR rendszerről / About (bemutató oldal, Google home page) | `about` | 3 | `hu/about.md`, `en/about.md` | https://kor.fejlesztesek.hu/legal/about | https://kor.fejlesztesek.hu/legal/about?locale=en |

Lista: `/legal` (és `/legal?locale=en`). JSON: `GET /api/legal-pages?locale=hu|en` (public role: `find`, `findOne`, a bootstrap állítja be).

## Nyelvek

- A slug **nem lokalizált**: minden nyelven ugyanaz, ezért az URL-ek stabilak. A `title` és a `body` lokalizált; a `footer_order` közös.
- Paraméter nélkül mindig a magyar változat jön. `?locale=en` az angol. Ha az angol bejegyzés hiányzik, a magyar jelenik meg egy rövid angol nyelvű figyelmeztetéssel.
- Minden oldal fejlécében HU / EN váltó van.
- A bootstrap (`ensureLegalLocales`) induláskor létrehozza a hiányzó `hu` és `en` locale-t. Ha a `hu`-t ő hozza létre, azt teszi alapértelmezetté; ha a `hu` már létezett, az alapértelmezésen nem változtat. Kézzel: Settings → Internationalization → Add new locale, és a `hu` mellett „Set as default locale”.

## Feltöltés

1. Strapi Admin → Content Manager → **Legal Page**. A jobb felső nyelvválasztóban legyen **Hungarian (hu)** → Create new entry.
2. **Cím:** a magyar cím (az oldalon `<h1>`-ként jelenik meg, a szövegbe ne írd újra).
3. **URL azonosító (slug):** pontosan a táblázat szerinti érték. A Google konzolban szereplő slugot később ne módosítsd.
4. **Tartalom:** a `hu/….md` fájl teljes tartalma, bemásolva a rich text (Markdown) szerkesztőbe. Előtte minden `[KITÖLTENDŐ: …]` jelölést cserélj le, és töröld a fájl elején lévő `>` figyelmeztető bekezdést.
5. **Sorrend:** a táblázat szerinti szám. Mentés. (Nincs draft/publish, a mentés azonnal él.)
6. Ugyanebben a bejegyzésben a nyelvválasztót állítsd **English (en)**-re: a slug és a sorrend már ki van töltve, add meg az angol címet és az `en/….md` tartalmát (a `[TO BE FILLED: …]` jelöléseket cseréld), majd mentsd.

A módosítás azonnal látszik, nincs szükség buildre: a `/legal/:slug` oldalt a Strapi minden kérésnél az adatbázisból rendereli (5 perces böngésző-cache-sel).

## Kezdőlap (Google „Application home page”)

Két lehetőség:

1. **Ajánlott, nincs teendő a szerveren:** a Google konzolba `https://kor.fejlesztesek.hu/legal/about` kerüljön.
2. **Gyökér átirányítás:** a kor alkalmazás cPanel környezeti változói közé `PUBLIC_HOME_REDIRECT=/legal/about`, majd újraindítás. Ekkor a `https://kor.fejlesztesek.hu/` 302-vel a bemutató oldalra visz (a Strapi alapból `/admin`-ra irányít). Az admin továbbra is `/admin` alatt érhető el. A változót **ne a közös `.env`-be** írd, mert az aliasok (pl. edizone) is örökölnék; ott a saját adatbázisban nincs `about` oldal.

## Formázás

A fájlok a Strapi rich text szerkesztő Markdown dialektusát követik (markdown-it, ugyanazt használja a szerver is): `##`/`###` fejlécek, **félkövér**, felsorolás, számozott lista, `[szöveg](url)` link, egyszerű táblázat, `>` idézet. Nyers HTML-t ne használj, a szerver escape-eli.
