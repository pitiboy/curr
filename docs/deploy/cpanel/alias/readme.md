# cPanel alias példány

Egy Strapi build fut több domainen. A kód, a `dist`, a `public` és a `node_modules` egy helyen van. Minden további domain külön cPanel Node.js alkalmazás, saját Neon adatbázissal és saját Cloudinary fiókkal. Az alias mappája nem tartalmazza az alkalmazást, csak elindítja a közös fát.

Jelenlegi elsődleges példány: `kor.fejlesztesek.hu`, mappa `node/kor-szupatak`. Az itteni `server.js` és `package.json` az `edizone.fejlesztesek.hu` aliasa, mappa `node/kor-edizone`.

## Mit hova tegyen a cPanel

| Szerep     | Alkalmazás-gyökér   | Tartalom                                                                                               |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| Elsődleges | `node/kor-szupatak` | A teljes Strapi: build, `public`, `package.json`, és a cPanel által létrehozott `node_modules` symlink |
| Alias      | `node/kor-edizone`  | Csak ennek a mappának a két fájlja                                                                     |

A cPanel a `node_modules` nevet symlinkként rakja az elsődleges gyökérbe. A célja `nodevenv/node/kor-szupatak/22/lib/node_modules`, oda kerül az `npm install` eredménye. Az alias ezt a linket használja, saját példányt nem kap.

Az elsődleges `server.js` a repó gyökerében lévő indító. Az alias `server.js` a betöltés előtt a saját `favicon.png` útvonalát teszi a `FAVICON_PATH` változóba, utána átvált a `/home/ysgljxyi/node/kor-szupatak` mappára, és azt a fájlt tölti be. A Node a csomagokat az elsődleges symlinkjén keresztül találja meg.

## Alias létrehozása

cPanel menüfeliratok: **angol (magyar)**. DotRollon a domainkezelő a **Domains (Domain nevek)** ikon; a régi „Tartományok / Aldomainek” külön menü nincs.

1. **Domains (Domain nevek)** → **Create a New Domain (Új domain létrehozása)**: `edizone.fejlesztesek.hu` (típus: **Registered Domain**). A Node.js űrlap csak a már létező tartományokat listázza.
   - A **Share document root** jelölőnégyzet felirata DotRollon pl.: *A dokumentum gyökerének (`/home/…/public_html`) megosztása a(z) “fejlesztesek.hu”.* Angolul: *If the document root is shared, the new domain will serve the same content as “fejlesztesek.hu”.* **Hagyd kikapcsolva.** Bekapcsolva a domain a fő `fejlesztesek.hu` tartalmát szolgálná ki, nem külön Passenger/Node alkalmazást; a beállítás létrehozás után **nem változtatható**.
   - Kikapcsolva a **Document Root (Dokumentum kezdőkönyvtár)** mező szerkeszthető (pl. `public_html/edizone`). Ez csak a domain statikus gyökere a cPanelben; a Strapi alias a **Setup Node.js App** gyökerében fut (`node/kor-edizone`), nem ebben a mappában.
2. **Setup Node.js App (Node.js alkalmazás beállítása)** → új alkalmazás. Verzió **22.23.3**, mód **Production**, gyökér `node/kor-edizone`, URL `edizone.fejlesztesek.hu` üres útvonallal, indító fájl `server.js`. A 22-es főverzió kötelező: a közös modulok ehhez a Node-hoz tartoznak.
3. A **File Manager (Fájlkezelő)**-rel másold ennek a mappának a `package.json` és `server.js` fájlját a `node/kor-edizone` gyökérbe. A cPanel enélkül a `package.json` nélkül nem indítja az alkalmazást. A fájl üres váz, függőség nélkül.
4. **Run NPM Install**-t az aliasen ne indíts. Saját `nodevenv` modulkészletet és saját symlinket hozna létre.
5. Add meg az alias környezeti változóit, ments, majd **Restart (Újraindítás)**.

Másik domainnél ugyanígy: új domain a **Domains (Domain nevek)** alatt, új Node.js alkalmazás 22-es Node-dal, és ez a két fájl. A `package.json` `name` mezője az adott alias neve legyen. A `server.js` útvonalai az elsődleges mappára mutassanak, a `FAVICON_PATH` pedig az alias saját mappájára. Ha a tárhely felhasználója vagy a mappa más, ezt a három útvonalat kell átírni.

## Környezeti változók

Az alias folyamata a közös mappa `.env` fájlját is betölti. A cPanelben megadott változó felülírja, a hiányzó kulcs a `kor` értéke marad. Az aliasnél ezért mindet el kell menteni:

- `PUBLIC_URL` — `https://edizone.fejlesztesek.hu`
- `DATABASE_URL` — **külön Neon Postgres database** aliasonként (ugyanaz a connection host/role lehet, a path `/dbname` különbözik). A kor URL-jét **ne** másold: közös DB-n a sémák és az adatok összekeverednek.
  - **Jelenlegi minta (kor / edizone):** egy Neon project (`curr-zep`), egy branch (`production`), több database ugyanazon a compute-on — nem külön project aliasonként. Branch overview → **Postgres database** mutatja a darabszámot („N databases”); a lista: project → **Databases**, vagy **Connect** → Database dropdown.
  - Létező példák ugyanitt: `neondb` (Neon default), `curr_zep` (kor), `curr_edizone` (edizone).
  - **Új alias (ajánlott, ugyanez a minta):**
    1. [Neon Console](https://console.neon.tech) → project `curr-zep` → **Databases** → **New database** (név pl. `curr_teszt_kor`; owner: `neondb_owner`).
    2. **Connection string** (ugyanitt, meglévő DB-hez is): a project / branch nézetben a fekete **Connect** gomb (felső nav vagy a compute kártyán) → megnyílik a *Connect to your branch* dialóg.
       - Branch: `production`
       - Database: az alias DB neve (pl. `curr_teszt_kor` — ne `neondb` / `curr_zep`)
       - Role: `neondb_owner`
       - **Connection pooling**: **On** (a hostnévben legyen `-pooler`)
       - Connection string típus: **URL** / Postgres URI (`postgresql://…`)
       - A mező melletti **másolás** ikon → illeszd a cPanel env `DATABASE_URL` értékébe egy az egyben (`sslmode=require` maradhat a query stringben).
  - **Opcionális:** külön Neon project (**New project**) is lehet erősebb izolációhoz; a korábbi aliasok nem így készültek. Ott is ugyanez a **Connect** dialóg adja a stringet.
- `DATABASE_SSL` — `true` (Neon kötelező). Üres DB-n az első Strapi indulás létrehozza a sémát; az admin user az alias `/admin` címén külön jön létre.
- Cloudinary — alias **külön** preset + folder (ne a korét). Ajánlott: külön product environment / fiók is; ha ugyanaz a cloud, legalább a preset és a folder legyen alias-specifikus.
  1. Nyisd a [Cloudinary Console](https://console.cloudinary.com/)-t, jelentkezz be (válaszd az alias product environmentjét, ha több van).
  2. API adatok: **Settings → API Keys** ([console.cloudinary.com/settings/api-keys](https://console.cloudinary.com/settings/api-keys)) → `Cloud name` → `CLOUDINARY_NAME`; `API Key` → `CLOUDINARY_KEY`; `API Secret` → `CLOUDINARY_SECRET`. Ne a kor cloud credentialjeit másold, ha külön fiókot / environmentet használsz.
  3. Preset: **Settings → Upload → Upload presets** ([console.cloudinary.com/settings/upload](https://console.cloudinary.com/settings/upload) → **Upload presets** tab) → **Add upload preset**.
  4. **Upload preset name**: pl. `teszt-kor` / `edizone` (ez lesz a `CLOUDINARY_UPLOAD_PRESET`). **Signing mode**: **Unsigned**. **Asset folder** / **Folder**: pl. `teszt-kor` / `edizone` — **ne** a kor `strapi-uploads` (vagy egyéb közös) folder. **Save**.
  5. cPanel env: `CLOUDINARY_UPLOAD_PRESET` = a preset neve; `CLOUDINARY_FOLDER` = ugyanaz a folder string, mint a presetben.
- `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY` — új titkok aliasonként. Generálás a repo gyökeréből: `node scripts/generate-secrets.js` (stdout `KEY=value` sorok; másold a cPanel env-be)
- `ADMIN_APP_TITLE` — Strapi Admin böngészőfül brand (pl. `EdiZone`). Runtime, nem a közös `.env`-be; hiányzik → `KÖR`
- Backoffice workflow kapcsolók: Strapi Admin → **Settings** collection (vagy httpyac seed: `npm run seed:http:edizone:backoffice-features -- prod`). Az alias `.env`-ben nincs külön env; példányonként az adatbázis dönt (edizone: `egg-daily-entry` enabled).
- Google OAuth — ugyanaz a Web application kliens, mint a kornál (új kliens nem kell). Részletes háttér: [backoffice-google-oauth.md](../../backoffice-google-oauth.md).
  1. [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients) → nyisd meg a meglévő **Web application** klienst (ugyanaz a projekt, mint a kornál).
  2. **Authorised redirect URIs** → **Add URI**: `https://<alias-domain>/api/connect/google/callback` (pl. `https://edizone.fejlesztesek.hu/api/connect/google/callback` vagy `https://teszt-kor.fejlesztesek.hu/api/connect/google/callback`). A kor és a localhost URI-k maradjanak. **Save**.
  3. **Authorised JavaScript origins**: nem kell bővíteni (a böngésző nem hívja közvetlenül a Google-t).
  4. **Authorised domains** (Branding / Audience): elég a `fejlesztesek.hu` — az alias aldomainhez nem kell külön domain a listába.
  5. cPanel env (alias): `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` = ugyanez a kliens (örökölhető a közös `.env`-ből, vagy másold explicit). `BACKOFFICE_OAUTH_CALLBACK` = `https://<alias-domain>/backoffice/` (záró perjel kötelező). `PUBLIC_URL` = `https://<alias-domain>`. A Google konzol redirect URI a **Strapi** callback; a `BACKOFFICE_OAUTH_CALLBACK` az **SPA** — a kettő nem ugyanaz.

A backoffice statikus fájlok a közös `public/backoffice` mappából jönnek; éles build után az API hívások az aktuális domain originjére mennek (edizone-on az edizone Strapi példányra, nem a kor hostra).

A `PORT` értékét a Passenger adja, nem kell beállítani.

## Favicon

A Strapi a `favicon.png` fájlt az alkalmazás gyökeréből olvassa. Az alias induláskor a közös gyökérbe vált, ezért útvonal nélkül mindkét domain a `node/kor-szupatak/favicon.png` ikont adná.

Az alias `server.js` betöltés előtt beállítja a `FAVICON_PATH` értékét. A fájl az alias mappájában van, a neve `favicon.png`, a tartalma az adott domain 32 pixeles ikonja. A `node/kor-szupatak/favicon.png` a `kor.fejlesztesek.hu` ikonja, azt az alias logója ne írja felül.

A `FAVICON_PATH` ne kerüljön a közös `.env` fájlba, mert azt mindkét folyamat betölti. Az elsődleges példányon a változó maradjon üres: ott a gyökér `favicon.png` érvényes.

A futó alkalmazás a `dist/config/middlewares.js` fájlt tölti. A middleware-változás a közös fa új buildje után kerül a `node/kor-szupatak` mappába. Az alias `server.js` külön, a `node/kor-edizone` gyökérbe kerül. Utána mindkét Node.js alkalmazást újra kell indítani. Az edizone ikonja a `node/kor-edizone/favicon.png`: a 32 pixeles PNG, nem a 16 pixeles.

## Frissítés

A kódot és a buildet csak a `node/kor-szupatak` mappában cseréld. Függőségváltáskor az NPM Install is csak ott fut. A kvóta és a kihagyható telepítés: [npm-install.md](../npm-install.md). Utána mindkét Node.js alkalmazást újra kell indítani. Az alias mappájából a `server.js` csak akkor cserélendő, ha az útvonalai változtak. A `favicon.png` az alias mappájában marad.

## Állapot

A bejegyzések, a felhasználók és a feltöltések nyilvántartása Neonban van, a fájlok Cloudinaryn. A közös mappa futás közben nem tárolja ezt az állapotot. Induláskor a Strapi írhat egy `.strapi-updater.json` fájlt. A `public/uploads` és a `.tmp` nem része a működő állapotnak, amíg mindkét alkalmazásnál megvan a `DATABASE_URL`. A Passenger `tmp/restart.txt` fájlja alkalmazás-gyökérenként külön van.
