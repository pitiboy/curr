# Excel → `transactions.json` (CURR seeder formátum)

**Cél:** A felhasználó által megadott helyi Excel-fájlból olyan `transactions.json` áll elő, amely **pontosan ugyanazt a sémát** követi, mint a repó meglévő lokális fájlja ugyanabban a `dataDir` mappában. A prompt **csak a JSON-t állítja elő**; az API-feltöltés külön lépés (lásd alul).

---

## Kontextus a repóban (csak olvasás)

| Forrás                                                      | Mit tanulj belőle                                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `database/seeders/http/kor/data/transactions.json`          | KÖR „Pénzmozgások” Excel-import: lookup táblák, `entered_key_fields`, sor-mezők                                                                  |
| `database/seeders/http/edizone/data/transactions.json`      | EdiZone tojás-lap: `importKeyPrefix: egg-sheet:`, `leg`, `related_transaction_entered_key`                                                       |
| `database/seeders/transaction-import-keys.mjs`              | `readWorkbook`, `buildTransactions`, `importKeys`, `fold()`, `resolveAccountLabel`, `ACCOUNT_ALIASES`, `COL`, `absAmountRow`, Excel dátum/összeg |
| `database/seeders/egg-sheet-to-transactions.mjs`            | Más forrás: `findHeaderIndex`, `parseCsvLine`, `egg-sheet:` kulcsok                                                                              |
| `database/seeders/http/common/transactions.http`            | Draft `POST`/`PUT` `/api/transactions?status=draft`, keresés `entered_key` szerint                                                               |
| `src/api/transaction/content-types/transaction/schema.json` | Kötelező API-mezők: `date`, `amount`, `description`, `credit_account`, `debit_account`, `currency_type`, `organization`                          |
| `src/transaction-import-key.ts`                             | `entered_key` részleges unique index (draft sorok)                                                                                               |

**Első lépés mindig:** Olvasd el a cél `dataDir/transactions.json` fájlt és a mellette lévő `accounts.json`, `organizations.json`, `transaction-types.json` fájlokat. Új sorokat **ehhez a fájlhoz** illeszd; a fájl tetején lévő lookup táblákat és meta mezőket **változatlanul hagyd**, hacsak a felhasználó kifejezetten nem kéri a bővítést.

---

## Bemenet / kimenet

- **Bemenet:** a felhasználó megadja az Excel útvonalát (pl. `Pénzmozgások.xlsx`). Kérdezd meg, ha hiányzik:
  - melyik `dataDir` a cél (pl. `database/seeders/http/kor/data` vagy `database/seeders/http/edizone/data`);
  - új fájl teljes felülírása, vagy meglévő `transactions.json` **kiegészítése / frissítése**.
- **Kimenet:** érvényes JSON, **ugyanaz a top-level szerkezet**, mint a meglévő fájlban:
  - meta: `source`, `keyPrefix`, opcionálisan `importKeyPrefix`, `currencyCode`, `mainOrganization`;
  - lookup: `projectOrganizations`, `partyAccounts`, `operationCreditAccounts`, `expenseDebitAccounts`, `placeTransactionTypes`, `operationTransactionTypes` (KÖR-nél);
  - `entered_key_fields` — **ne változtasd**, ha a felhasznár nem kéri; ez határozza meg az `entered_key` hash-t;
  - `transactions`: tömb soronként.

### Dátum és összeg konvenciók

- **Dátum:** ISO `YYYY-MM-DD` (pl. KÖR Excel: `excelDate` = 1899-12-30 + serial nap, lásd `transaction-import-keys.mjs`).
- **Összeg:** mindig **pozitív** (`absAmountRow`); az irányt a `credit_label` / `debit_label` (és feloldott `credit_account` / `debit_account`) határozza meg, nem az előjel.
- **Üres / összesítő sorok:** hagyd ki (nincs dátum + nincs kötelező számlacímke + nincs összeg).

### KÖR „Pénzmozgások” referencia-oszlopok (`COL` a scriptben)

Ha a lap neve vagy szerkezete egyezik a KÖR munkalappal, ezek az elvárások (1-alapú oszlopindex):

| Index | Fejléc (Excel)       | JSON mező                            |
| ----- | -------------------- | ------------------------------------ |
| 1     | Date                 | `date`                               |
| 4     | (Forrás)             | `payer`                              |
| 5     | credit_Account       | `credit_label`                       |
| 6     | (Kinek)              | `payee`                              |
| 7     | Debit_account        | `debit_label`                        |
| 8     | Cél hely             | `ledger`                             |
| 9     | Organization/Projekt | `project` → feloldás: `organization` |
| 10    | Rendeltetés          | `purpose`                            |
| 11    | Művelet              | `operation`                          |
| 12    | Amount               | `amount`                             |
| 13    | Hely                 | `place`                              |
| 14    | Leírás               | `description`                        |

Más Excelnél ne feltételezd ezt a layoutot — használd az alias-táblát és a meglévő JSON példáit.

---

## Tanulás a meglévő rekordokból (kötelező)

- [ ] Minták: `description` stílus, `operation` / `purpose` / `place` értékek, tipikus `payer`/`payee` nevek.
- [ ] Számlacímkék: a meglévő `credit_label` / `debit_label` szövegek és feloldott `credit_account` / `debit_account` (könyv név, `tag:<azonosító>`, `saját:<azonosító>`).
- [ ] Szervezetek: pontos név a `organizations.json`-ból vagy `projectOrganizations` mapből.
- [ ] Tranzakciótípusok: meglévő `transaction_type` vagy lookup (`operationTransactionTypes` > `placeTransactionTypes`).
- [ ] **Új könyvi számlanevet vagy szervezetnevet soha ne találj ki** — minden feloldott érték a meglévő `accounts.json` / `organizations.json` / lookup táblák közül jön. Ha az Excelben nincs számla, **kötelező javaslat** (lásd alább), nem üres mező.

---

## Oszlop → mező megfeleltetés (best-guess)

Fejlécillesztés: **kis-/nagybetű és ékezet független** (`fold()` + `toLocaleLowerCase('hu')`).

### Alias tábla (magyar | angol → célmező)

| Fejléc aliasok (példák)                                     | Cél                                             |
| ----------------------------------------------------------- | ----------------------------------------------- |
| dátum, date, könyvelés dátuma, datum, időpont               | `date`                                          |
| összeg, amount, érték, összérték, ft, forint                | `amount`                                        |
| leírás, közlemény, description, megjegyzés, comment         | `description`                                   |
| követel, credit, credit_account, bejövő, jóváírás, incoming | `credit_label`                                  |
| tartozik, debit, debit_account, kimenő, terhelés, outgoing  | `debit_label`                                   |
| forrás, payer, fizető, ki fizetett                          | `payer`                                         |
| kinek, payee, kedvezményezett, partner, címzett             | `payee`                                         |
| szervezet, projekt, organization, project                   | `project` → `organization`                      |
| rendeltetés, purpose, kategória (költség)                   | `purpose`                                       |
| művelet, operation                                          | `operation`                                     |
| hely, place, fizetési mód                                   | `place`                                         |
| cél hely, ledger                                            | `ledger`                                        |
| deviza, currency, pénznem                                   | `currency` (soronként) vagy fájl `currencyCode` |

### Tartalék logikák

1. **Egy előjeles összegoszlop:** előjel nem marad az `amount`-ban; a jel alapján cseréld / jelöld a credit-debit oldalt, vagy a meglévő JSON mintáját kövesd.
2. **Külön bejövő / kimenő oszlopok:** a nem nulla értékű oszlop határozza meg az irányt; összeg = abszolút érték.
3. **Fejléc hiányzik:** oszlopstatisztika — dátum típusú cellák, számformátum, szöveg hossz; jelezd feltételezésként a záró összefoglalóban.
4. **Excel serial dátum:** numerikus cella → `YYYY-MM-DD` (lásd fent).
5. **Magyar számformátum:** `1 234 567,89` → térköz törlés, vessző → tizedes; `Ft` utótag eltávolítása.

---

## Számlafeloldás (a meglévő lookupokkal)

Sorokban először **`credit_label` / `debit_label`** marad az Excel szövege; a feloldott mezők:

1. Pontos név egyezés a könyvben (`accounts.json` nevek, `fold()`).
2. `ACCOUNT_ALIASES` a `transaction-import-keys.mjs`-ben (pl. `Pénztár - Saját számla` → `Készpénz`).
3. Minta: `Név - Tagi számla` / `Név - Saját számla` → `tag:<azonosító>` / `saját:<azonosító>` (`memberIdentifierBase` szabályok).

A JSON tetején lévő **`partyAccounts`**, **`operationCreditAccounts`**, **`expenseDebitAccounts`** a seeder tartalék logikáját szolgálják; az agent **mégis töltse ki** a soron a `credit_label` / `debit_label` és a feloldott `credit_account` / `debit_account` mezőket, ha az Excel üres — lásd a következő szakaszt.

---

## Számla javaslása, ha az Excelben nincs megadva

Ha a credit és/vagy debit oszlop **üres** vagy nem feloldható, a kimeneti JSON **nem maradhat** üres címkével vagy csak „nem feloldott” listával: add meg a legvalószínűbb számlát a meglévő könyvből, és **dokumentáld** a záró összefoglalóban.

### Kötelező kitöltés

- Minden feldolgozott soron legyen **`credit_label` és `debit_label`** (a meglévő fájl mintájának megfelelő szöveg — pl. könyv név vagy `Név - Tagi számla`).
- Minden soron legyen **`credit_account` és `debit_account`**: pontos név az `accounts.json`-ból, vagy `tag:<azonosító>` / `saját:<azonosító>`.
- **Soha ne hozz létre új számlanevet**, ami nincs az `accounts.json`-ban (kivéve a már bevett `tag:` / `saját:` azonosító formátumot).

### Javaslati prioritás (hiányzó oldalra)

A hiányzó **credit** és **debit** oldalt **külön-külön** töltsd ki, ebben a sorrendben — állj meg az első érvényes, meglévő számlánál:

1. **Partner / payee / payer** — `partyAccounts[payer]`, `partyAccounts[payee]`; tagi minta: `payer`/`payee` név → `tag:<azonosító>` vagy `Név - Tagi számla` címke, ha a meglévő sorokban így szerepel.
2. **Leírás kulcsszavak** — hasonló `description` minták a cél `transactions.json`-ban (pl. „részjegy”, „utalás”, „anyag”) → ugyanaz a credit/debit pár.
3. **Szervezet / projekt** — `organization` és tipikus költség/bevétel számlák ugyanerre a szervezetre a meglévő adatban.
4. **Tranzakció iránya** — bejövő (jóváírás) vs kimenő (terhelés): a meglévő adatban az irányhoz leggyakoribb cash/bank oldal (credit = honnan jön a pénz, debit = hova megy; kövesd a KÖR mintákat).
5. **Excel előjel** (mielőtt abszolút `amount`): az előjel segíthet az irány felismerésében, ha más jel nincs.
6. **Legközelebbi meglévő sor** — ugyanaz partner + hasonló leírás / ugyanaz `operation`+`purpose` → másold a párosított számlákat.
7. **Lookup táblák** a JSON tetején:
   - credit: `operationCreditAccounts[operation]`, majd `partyAccounts[payer]`
   - debit: ha `operation === "Költség"` → `expenseDebitAccounts[purpose]`, különben `partyAccounts[payee]`
8. **Alapértelmezés irány szerint** — a cél fájl statisztikájából: leggyakoribb credit (pl. `Készpénz`, `Bankszámlák`) és leggyakoribb költség/bevétel debit, ha mást nem találsz; **alacsony** biztonsággal jelöld.

### Átláthatóság (séma változatlan)

- **Ne** adj hozzá új mezőt a sorokhoz (pl. `suggested: true`), hacsak a cél `transactions.json` már nem tartalmaz ilyet.
- Minden **nem Excelből jött** számla szerepeljen a záró összefoglaló **„Javasolt számlák”** táblázatában:

| Sor (`row`) | Mező (`credit_label` / `debit_label` / …) | Javasolt számla | Indok (rövid) | Biztonság (magas / közepes / alacsony) |

A feltöltés draft marad (`?status=draft`), ezért a javaslatok emberi ellenőrzésre várnak, de a JSON **importálható** legyen.

---

## `entered_key` (deduplikáció, újraimport)

Követni: `importKeys()` (`transaction-import-keys.mjs`).

1. Olvasd a fájl **`entered_key_fields`** listáját (pl. KÖR: `currency`, `date`, `amount`, `payer`, `payee`, `organization`; EdiZone: + `leg`, `sheet_row`, `debit_account`, `credit_account`).
2. Minden sorhoz kanonikus JSON string: a mezők **sorrendben**, normalizálva (`amount` → 2 tizedes, szöveg → `fold()`; `currency` hiányában fájl `currencyCode`).
3. `sha256` → első **20 hex** karakter.
4. Prefix: `importKeyPrefix` vagy alapértelmezés **`excel:`** (EdiZone: `egg-sheet:`).
5. Formátum: `{prefix}{hash}`; azonos hash ismét: `#2`, `#3`… **fájl sorrendben** (az Excel sor száma **nincs** a kulcsban).
6. Minden sorhoz írd be az `entered_key` mezőt a JSON-ban.

Így az `npm run seed:http:…:transactions` **PUT**-tal frissít, nem duplikál (`entered_key` egyezés).

---

## Validáció (kötelező ellenőrzőlista)

- [ ] Minden sor: `date`, `amount`, `description`, kitöltött `credit_label`, `debit_label`, `credit_account`, `debit_account` (üres számla **nem** megengedett — hiány esetén javaslat a fenti szabályokkal).
- [ ] `amount` > 0, szám, max. 2 tizedes a JSON-ban ahogy a meglévő fájlban.
- [ ] Minden `credit_account` / `debit_account` **létező** könyv név vagy `tag:`/`saját:` az `accounts.json` + aliasok alapján — **csendben új név tiltva**.
- [ ] `organization` név szerepel az `organizations.json`-ban, vagy a `projectOrganizations` mapből feloldható, vagy üres → `mainOrganization`.
- [ ] `transaction_type` (ha van) szerepel a `transaction-types.json`-ban, vagy lookupból származik.
- [ ] `entered_key` egyedi a fájlon belül.
- [ ] **Javasolt számlák** (Excelből nem jött): mind szerepeljen a záró összefoglaló táblázatában (sor, mező, számla, indok, biztonság).
- [ ] **Nem feloldható (nem számla):** szervezet, ismeretlen Excel-címke stb. — listázd külön emberi döntéssel; számlára **mindig** adj meglévő könyvi javaslatot, ne hagyd üresen és ne „csak listázd feloldatlanként”.

Opcionálisan javasold a felhasználónak:

```bash
node database/seeders/transaction-import-keys.mjs /path/to/dataDir/transactions.json --check
```

---

## Kimeneti formátum

- JSON, 2 szóköz behúzás, fájl végén újsor (`transactions.json` mint a repóban).
- Sor mezők: a cél fájl **meglévő sorait** példaként kövesd (KÖR: `row`, `entered_key`, címkék + feloldott accounts, stb.; EdiZone: `sheet_row`, `leg`, `related_transaction_entered_key` ha kell).
- **Ne** módosítsd a repó seed scriptjeit; csak a felhasználó által megadott kimeneti útvonalra írj.

---

## Záró összefoglaló a felhasználónak (magyarul, rövid)

Minden futás végén add meg:

1. Észlelt oszlop-megfeleltetés (táblázat).
2. Feltételezések (hiányzó fejléc, dátum/összeg típus).
3. Konvertált / kihagyott sorok száma + okok.
4. **Javasolt számlák** táblázat (minden kitöltött, Excelből nem eredő credit/debit: sor, mező, számla, indok, magas/közepes/alacsony biztonság).
5. **Nem feloldott** egyéb értékek (főleg szervezet, típus, ismeretlen címke) — emberi döntés; számlák ide **ne** kerüljenek, ha már javaslatként ki lettek töltve.
6. Következő lépés: kulcsellenőrzés (`--check`) és feltöltés (lásd alul).

Cél: **nulla vagy minimális** kézi szerkesztés.

---

## Feltöltés (ez a prompt NEM végzi)

A JSON készítése után a meglévő httpyac seeder futtatható (token: `http-client.private.env.json`, előbb 01–09 seederek):

```bash
npm run seed:kor:transactions:keys   # KÖR: kulcsok újraszámolása Excelből, ha a scriptet használod
npm run seed:http:kor:transactions -- local
npm run seed:http:kor:transactions:local
npm run seed:http:edizone:transactions:local
```

A seeder draft tranzakciókat hoz létre / frissít (`?status=draft`), `entered_key` szerint keres. Részletek: `database/seeders/http/common/transactions.http`.

---

## OPCIONÁLIS — Strapi API példák (alapértelmezés: **KI**)

> Csak akkor futtasd, ha a felhasználó **kifejezetten** kéri a DB-ből származó tranzakciók felhasználását (extra minták, duplikátum-ellenőrzés). **Soha** ne írj az API-ra.

- Környezet: `STRAPI_URL` (pl. `http://localhost:1337`), `STRAPI_API_TOKEN` — csak env-ből; **ne** logold, commitold, ne írd ki a chatbe.
- Csak **GET**, lapozva, pl.:
  - `GET {STRAPI_URL}/api/transactions?status=draft&pagination[pageSize]=100&pagination[page]=1&sort=date:desc`
  - Szükség szerint: `populate[credit_account][fields][0]=name&populate[debit_account][fields][0]=name&populate[organization][fields][0]=name&populate[currency_type][fields][0]=code&populate[transaction_type][fields][0]=name`
  - Header: `Authorization: Bearer $STRAPI_API_TOKEN`
- A draft/publish és populate nevek egyezzenek a `schema.json` relációival és a Content API dokumentációval; eltérés esetén a repó `transactions.http` mintáját kövesd.
- A lekért adat csak **olvasási minta** és duplikátum-gyanú; a kimeneti JSON forrása továbbra is az Excel + lokális `transactions.json` lookupok.

---

## Gyors ellenőrzőlista az agentnek

- [ ] Meglévő `dataDir/transactions.json` + lookup JSON-ok elolvasva
- [ ] Excel beolvasva, üres/összesítő sorok kihagyva
- [ ] Oszlop-map dokumentálva, aliasok alkalmazva
- [ ] Dátum ISO, összeg abszolút, címkék a meglévő mintához igazítva
- [ ] Hiányzó Excel-számla → kitöltött credit/debit + javaslat a záró táblázatban
- [ ] `entered_key` minden új/frissített soron, duplikátumok `#n` jelöléssel
- [ ] Validáció + javasolt számlák + nem feloldott (nem számla) lista
- [ ] Magyar összefoglaló a felhasználónak
- [ ] (Opcionális DB) csak explicit kérésre, csak GET, token biztonság
