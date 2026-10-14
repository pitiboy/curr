# Dotroll cPanel: NPM Install

Az FTP a `node_modules`-t nem viszi fel. A cPanel symlinkje megmarad, a csomagok a `nodevenv/node/kor-szupatak/22/lib/node_modules` alatt vannak. Ha a `package.json` és a `package-lock.json` nem változott, új telepítés nem kell: a korábbi fa elég az induláshoz.

A futó admin és a collection type lista azt jelenti, hogy a Strapi elindult. Az üres lista („0 entries found”) üres tartalom.

## Mikor kell telepíteni

Csak akkor, ha a lockfile változott, vagy egy művelet hiányzó modullal elhasal. A félbemaradt NPM Install logot hagyd, amíg az admin és az API válaszol. A deploy script „NPM Install” sora erre az esetre szól.

Telepítés előtt a Fájlkezelőben töröld a `nodevenv/node/kor-szupatak/22/lib/node_modules` tartalmát. A kvóta 3096 MB, a `nodevenv` ebből kb. 1,6 GB. Az install a régi fa mellé másol, és enélkül megtelik a lemez. Kell kb. 1,2 GB szabad hely. Az alkalmazásgyökér `node_modules` symlinkjét ne töröld: az a fenti mappára mutat.

Az NPM Install csak a `kor.fejlesztesek.hu` alkalmazáson fut, gyökér `node/kor-szupatak`. Az `edizone` aliasra ne.

A build helyben készül, utána jön az FTP. A szerveren ne futtass `npm run build`-et.

## Kész

Az admin betölti a collection type-okat, az API válaszol. Deprecation és debug sor a logban nem hiba.

## Hely a futó app mellett

A home `.npm` mappáját ne töröld. Csak a `/home/ysgljxyi/.npm/_cacache` tartalmát. Ez a letöltött csomagok cache-e, a futó Strapi nem olvassa, a következő telepítés újra létrehozza. A `_logs` és a `_prebuilds` maradjon.
