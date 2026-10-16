> **Kitöltendő a közzététel előtt:** minden `[KITÖLTENDŐ: …]` jelölést cserélj ki a valós adatra, majd töröld ezt a bekezdést. A szöveg sablon, nem jogi tanácsadás; élesítés előtt érdemes adatvédelmi szakemberrel átnézetni.

## 1. Az adatkezelő

| Adat | Érték |
| --- | --- |
| Név | [KITÖLTENDŐ: az üzemeltető szervezet vagy személy teljes neve] |
| Székhely / cím | [KITÖLTENDŐ: székhely vagy levelezési cím] |
| Nyilvántartási szám / adószám | [KITÖLTENDŐ: cégjegyzékszám, nyilvántartási szám vagy adószám] |
| Képviselő | [KITÖLTENDŐ: képviselő neve] |
| Kapcsolattartási e-mail | [KITÖLTENDŐ: adatvédelmi kérdésekre használt e-mail cím] |
| Adatvédelmi tisztviselő | [KITÖLTENDŐ: név és elérhetőség, vagy „nincs kijelölve”] |

A továbbiakban: **Üzemeltető** vagy **mi**.

## 2. A szolgáltatás röviden

A **KÖR – Közösségi Önjegyző Rendszer** (angolul CURR – Community Unified Resource Registry) a [https://kor.fejlesztesek.hu](https://kor.fejlesztesek.hu) címen elérhető, zárt körű nyilvántartó rendszer. Közösségek és szervezetek pénzügyi és egyéb erőforrás-mozgásait (például pénz, munkaóra, termény) rögzíti kettős könyvelési logikával, a hozzájuk tartozó bizonylatokkal együtt.

- **Kezelő felület:** [https://kor.fejlesztesek.hu/backoffice/](https://kor.fejlesztesek.hu/backoffice/) – tranzakciók rögzítése, ellenőrzése és véglegesítése.
- **Adminisztrációs felület:** [https://kor.fejlesztesek.hu/admin](https://kor.fejlesztesek.hu/admin) – az üzemeltetők és fejlesztők felülete.

A rendszerbe **nincs nyilvános regisztráció**. Felhasználói fiókot csak az Üzemeltető adminisztrátora hoz létre, és ő rendeli hozzá a szerepkört (adatrögzítő vagy szerkesztő).

## 3. Milyen személyes adatokat kezelünk

### 3.1 Felhasználói fiók

- e-mail cím,
- felhasználónév (Google-belépésnél az e-mail cím @ előtti része),
- a jelszó kriptográfiai lenyomata (hash) – csak e-mail + jelszó belépésnél; magát a jelszót nem tároljuk,
- a belépés módja (helyi jelszó vagy Google),
- szerepkör (adatrögzítő vagy szerkesztő), a fiók állapota (aktív, letiltott),
- a fiók létrehozásának és módosításának időpontja.

### 3.2 Bejelentkezés Google-fiókkal

Ha a „Bejelentkezés Google-lel” gombot használod, a Google a hozzájárulásod után **kizárólag az e-mail címedet és annak megerősített állapotát** adja át nekünk (`email` hatókör). Ezzel azonosítjuk a meglévő fiókodat.

- Nem kérünk hozzáférést a Gmail fiókodhoz, a névjegyeidhez, a naptáradhoz, a Google Drive-hoz vagy más Google-szolgáltatáshoz.
- A Google-jelszavadat nem látjuk és nem tároljuk.
- A Google által kiadott hozzáférési tokent csak a belépés pillanatában, az e-mail cím lekérdezésére használjuk, nem tároljuk el.

### 3.3 Munkamenet és böngészőben tárolt adatok

- **Munkamenet-süti (session cookie):** a bejelentkezés biztonságos lebonyolításához szükséges, technikai süti.
- **Böngésző helyi tárolója (localStorage):** a belépés után kapott hozzáférési token és az alapvető felhasználói adatok (azonosító, e-mail, felhasználónév, szerepkör), valamint a felület beállításai (például nyelv, téma, listanézet).
- **Munkamenet-tároló (sessionStorage):** a Google-belépés folyamatát jelző átmeneti érték.

Nem használunk analitikai, reklám- vagy követő sütiket, és nem építünk profilt a látogatókról.

### 3.4 A rendszerben rögzített tartalmak

- **Tranzakciók:** dátum, összeg, pénznem, leírás, érintett számlák és szervezet, valamint az, hogy **melyik felhasználó rögzítette és véglegesítette**, és mikor.
- **Bizonylatok:** a feltöltött fájl (számla, nyugta, szerződés stb.), az eladó vagy partner neve, az összeg, a dátum, a leírás. Egy bizonylat harmadik személyek (például magánszemély eladó) személyes adatait is tartalmazhatja.
- **Tagnyilvántartás:** a közösség tagjainak neve, e-mail címe, azonosítója, tagsági adatai (szervezet, tagság típusa, érvényesség) és a hozzájuk tartozó számla.

### 3.5 Szervernaplók

A tárhely szerverei technikai naplót vezetnek a kérésekről (IP-cím, időpont, kért cím, böngésző típusa, válaszkód). Ezt a hibakereséshez és a visszaélések kivédéséhez használjuk.

## 4. Az adatkezelés céljai és jogalapjai

| Cél | Adatok | Jogalap (GDPR 6. cikk (1)) |
| --- | --- | --- |
| Belépés és jogosultságkezelés | 3.1, 3.2, 3.3 | f) jogos érdek: a rendszert csak az arra jogosultak használhassák [KITÖLTENDŐ: ha a használat tagsági vagy munkaviszonyon alapul, b) pont is lehet] |
| Pénzügyi nyilvántartás és bizonylatok megőrzése | 3.4 tranzakciók és bizonylatok | c) jogi kötelezettség a számvitelről szóló 2000. évi C. törvény alapján [KITÖLTENDŐ: ellenőrizd, hogy a szervezetre vonatkozik-e], egyébként f) jogos érdek |
| Ki mit rögzített és véglegesített (felelősség, ellenőrizhetőség) | rögzítő és véglegesítő felhasználó, időpontok | f) jogos érdek: a nyilvántartás hitelessége |
| Tagnyilvántartás | 3.4 tagnyilvántartás | b) a tagsági jogviszony teljesítése [KITÖLTENDŐ: az alapszabály vagy a tagsági megállapodás hivatkozása] |
| Üzembiztonság, visszaélések kivédése | 3.5 | f) jogos érdek |

A jogos érdeken alapuló adatkezelés ellen bármikor tiltakozhatsz (lásd 9. pont).

## 5. A Google-tól kapott adatok felhasználása

A Google API-kon keresztül kapott adatokat (e-mail cím) **kizárólag a belépéshez és a fiókod azonosításához** használjuk. Nem adjuk el, nem adjuk át harmadik félnek, nem használjuk reklámcélra, és ember nem olvassa el, kivéve, ha ehhez hozzájárulsz, ha biztonsági okból vagy jogszabály alapján szükséges.

The use and transfer of information received from Google APIs to any other app will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## 6. Kik férhetnek hozzá az adatokhoz

- **Az Üzemeltető adminisztrátorai** – teljes hozzáférés az üzemeltetéshez szükséges mértékben.
- **A rendszer felhasználói** – a szerepkörüknek megfelelően látják a tranzakciókat, bizonylatokat és a rögzítő/véglegesítő felhasználó nevét.
- **Adatfeldolgozók:**

| Adatfeldolgozó | Feladat | Hely |
| --- | --- | --- |
| [KITÖLTENDŐ: tárhelyszolgáltató neve, székhelye] | a szerver és a webhely üzemeltetése, szervernaplók | [KITÖLTENDŐ: ország] |
| [KITÖLTENDŐ: adatbázis-szolgáltató neve, ha nem azonos a tárhellyel] | adatbázis tárolása | [KITÖLTENDŐ: ország] |
| Cloudinary ([cloudinary.com](https://cloudinary.com)) | a feltöltött bizonylatfájlok tárolása | [KITÖLTENDŐ: adattárolási régió; EGT-n kívül esetén az átadás jogalapja, pl. általános szerződési feltételek] |

- **Google** a Google-belépés során önálló adatkezelőként jár el; erről a [Google adatvédelmi irányelvei](https://policies.google.com/privacy) szólnak.

Személyes adatot nem adunk el, és reklámcélra nem adunk át.

## 7. Meddig őrizzük az adatokat

| Adat | Megőrzési idő |
| --- | --- |
| Felhasználói fiók | a hozzáférés megszűnéséig, utána [KITÖLTENDŐ: pl. 30 nap] |
| Tranzakciók, bizonylatok, a rögzítő és véglegesítő adatai | a számviteli bizonylatokra irányadó **legalább 8 év** (2000. évi C. törvény 169. §), egyébként [KITÖLTENDŐ] |
| Tagnyilvántartás | a tagság megszűnése után [KITÖLTENDŐ: időtartam] |
| Szervernaplók | [KITÖLTENDŐ: pl. 30 nap, a tárhelyszolgáltató beállítása szerint] |
| Böngészőben tárolt adatok | kijelentkezésig, illetve amíg a böngészőből nem törlöd |

## 8. Adatbiztonság

- Minden kapcsolat titkosított (HTTPS).
- A jelszavakat csak kriptográfiai lenyomatként tároljuk.
- A hozzáférés szerepkörökhöz kötött; a véglegesített tranzakciók utólag nem írhatók át.
- Fiókot csak adminisztrátor hozhat létre.

## 9. A jogaid

Az adatkezeléssel kapcsolatban jogosult vagy:

- **hozzáférést** kérni a rólad kezelt adatokhoz,
- kérni az adatok **helyesbítését**,
- kérni az adatok **törlését**, ha nincs olyan kötelezettség, amely a megőrzést előírja (például a számviteli bizonylatoké),
- kérni az adatkezelés **korlátozását**,
- élni az **adathordozhatóság** jogával,
- **tiltakozni** a jogos érdeken alapuló adatkezelés ellen.

Kérésedet a(z) [KITÖLTENDŐ: kapcsolattartási e-mail cím] címre küldd. Legkésőbb egy hónapon belül válaszolunk.

A Google-belépéshez adott hozzáférést bármikor visszavonhatod a Google-fiókodban: [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## 10. Jogorvoslat

Ha úgy érzed, hogy megsértettük az adatvédelmi jogaidat, panaszt tehetsz a **Nemzeti Adatvédelmi és Információszabadság Hatóságnál** (NAIH):

- cím: 1055 Budapest, Falk Miksa utca 9–11.
- postacím: 1363 Budapest, Pf. 9.
- e-mail: ugyfelszolgalat@naih.hu
- honlap: [https://naih.hu](https://naih.hu)

Bírósághoz is fordulhatsz; a pert a lakóhelyed vagy tartózkodási helyed szerinti törvényszék előtt is megindíthatod.

## 11. A tájékoztató módosítása

A tájékoztatót a szolgáltatás változásakor frissítjük. Az aktuális változat mindig ezen a címen érhető el: [https://kor.fejlesztesek.hu/legal/privacy-policy](https://kor.fejlesztesek.hu/legal/privacy-policy) ([angol nyelvű változat](https://kor.fejlesztesek.hu/legal/privacy-policy?locale=en)). Eltérés esetén a magyar változat az irányadó.

**Hatályos:** [KITÖLTENDŐ: hatálybalépés dátuma, pl. 2026. 10. 20.]
