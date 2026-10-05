# cPanel alias példány

Egy Strapi build fut több domainen. A kód, a `dist`, a `public` és a `node_modules` egy helyen van. Minden további domain külön cPanel Node.js alkalmazás, saját Neon adatbázissal és saját Cloudinary fiókkal. Az alias mappája nem tartalmazza az alkalmazást, csak elindítja a közös fát.

Jelenlegi elsődleges példány: `kor.fejlesztesek.hu`, mappa `node/kor-szupatak`. Az itteni `server.js` és `package.json` az `edizone.fejlesztesek.hu` aliasa, mappa `node/kor-edizone`.

## Mit hova tegyen a cPanel

| Szerep | Alkalmazás-gyökér | Tartalom |
| --- | --- | --- |
| Elsődleges | `node/kor-szupatak` | A teljes Strapi: build, `public`, `package.json`, és a cPanel által létrehozott `node_modules` symlink |
| Alias | `node/kor-edizone` | Csak ennek a mappának a két fájlja |

A cPanel a `node_modules` nevet symlinkként rakja az elsődleges gyökérbe. A célja `nodevenv/node/kor-szupatak/22/lib/node_modules`, oda kerül az `npm install` eredménye. Az alias ezt a linket használja, saját példányt nem kap.

Az elsődleges `server.js` a repó gyökerében lévő indító. Az alias `server.js` átvált a `/home/ysgljxyi/node/kor-szupatak` mappára, és azt a fájlt tölti be. A Node a csomagokat az elsődleges symlinkjén keresztül találja meg.

## Alias létrehozása

1. **Tartományok** → **Új tartomány létrehozása**: `edizone.fejlesztesek.hu`. A dokumentumgyökér megosztása maradjon kikapcsolva. A Node.js űrlap csak a már létező tartományokat listázza.
2. Új Node.js alkalmazás. Verzió **22.23.3**, mód **Production**, gyökér `node/kor-edizone`, URL `edizone.fejlesztesek.hu` üres útvonallal, indító fájl `server.js`. A 22-es főverzió kötelező: a közös modulok ehhez a Node-hoz tartoznak.
3. A Fájlkezelővel másold ennek a mappának a `package.json` és `server.js` fájlját a `node/kor-edizone` gyökérbe. A cPanel enélkül a `package.json` nélkül nem indítja az alkalmazást. A fájl üres váz, függőség nélkül.
4. **NPM Installt az aliasen ne indíts.** Saját `nodevenv` modulkészletet és saját symlinket hozna létre.
5. Add meg az alias környezeti változóit, ments, majd **Újraindítás**.

Másik domainnél ugyanígy: új tartomány, új Node.js alkalmazás 22-es Node-dal, és ez a két fájl. A `package.json` `name` mezője az adott alias neve legyen. A `server.js` útvonalai az elsődleges mappára mutassanak. Ha a tárhely felhasználója vagy az elsődleges mappa más, csak a `server.js` két útvonalát kell átírni.

## Környezeti változók

Az alias folyamata a közös mappa `.env` fájlját is betölti. A cPanelben megadott változó felülírja, a hiányzó kulcs a `kor` értéke marad. Az aliasnél ezért mindet el kell menteni:

- `PUBLIC_URL` — `https://edizone.fejlesztesek.hu`
- `DATABASE_URL` — az alias saját Neon connection stringje
- `DATABASE_SSL` — `true`
- `CLOUDINARY_NAME`, `CLOUDINARY_KEY`, `CLOUDINARY_SECRET`, `CLOUDINARY_UPLOAD_PRESET`
- `CLOUDINARY_FOLDER` — az aliastól függő mappa, például `edizone`
- `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY` — új titkok

A `PORT` értékét a Passenger adja, nem kell beállítani. Üres Neon adatbázison az első indulás létrehozza a sémát. Az admin felhasználó az alias `/admin` címén külön jön létre.

## Frissítés

A kódot és a buildet csak a `node/kor-szupatak` mappában cseréld. Függőségváltáskor az NPM Install is csak ott fut. Utána mindkét Node.js alkalmazást újra kell indítani. Az alias mappája változatlan marad.

## Állapot

A bejegyzések, a felhasználók és a feltöltések nyilvántartása Neonban van, a fájlok Cloudinaryn. A közös mappa futás közben nem tárolja ezt az állapotot. Induláskor a Strapi írhat egy `.strapi-updater.json` fájlt. A `public/uploads` és a `.tmp` nem része a működő állapotnak, amíg mindkét alkalmazásnál megvan a `DATABASE_URL`. A Passenger `tmp/restart.txt` fájlja alkalmazás-gyökérenként külön van.
