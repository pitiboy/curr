# PRD 0002: Content Backoffice v2 (roadmap)

**Status:** draft  
**Date:** 2026-10-12, kiegészítve 2026-10-14  
**Product:** `content-backoffice`  
**Depends on:** [0001-content-backoffice-v1](./0001-content-backoffice-v1.md)  
**Related ADR:** [0001-react-admin-content-ui](../adr/0001-react-admin-content-ui.md)  
**Domain:** [docs/readme.md](../readme.md)

## 1. Cél

Ez a dokumentum a v1-ből **szándékosan kihagyott** funkciókat gyűjti össze, és a későbbi üzemeltetés meg a teljesítmény megfontolásait. Nem szállítható sprint-scope; prioritás és szeletelés a v1 élesítése után történik.

A menükatalógus előtt a könyvelési kör és a futási alap kerül sorra. A kompetenciák, a telephely, a feladatkezelés és a munkaidő a [domain-leírás](../readme.md#missing-items-to-consider-for-further-addition) későbbi tételei, nem ennek a PRD-nek a scope-ja.

## 2. Access és multi-tenancy

### 2.1 Org–user összerendelés (fa alapú ACL)

- Az `organization` fa struktúra. v2: org ↔ Content user összerendelések.
- Az SPA csak az összerendelt org(ok) (és opcionálisan leszármazottak) adatait mutatja / engedi módosítani.
- Egy user több szervezetet kezelhet, de a láthatóság kötött.
- Backend: query filter + policy (ne csak kliens oldali szűrés).

### 2.2 user ↔ member kapcsolat (opcionális)

- A `member` rekordok tényleges tagok; nem minden tag rendelkezik belépéssel.
- v2: opcionális kapcsolat Content user és `member` között (pl. későbbi személyes nézetekhez).
- Nem helyettesíti az org–user ACL-t; kiegészítő identity bridge.

## 3. Termékfelület bővítés

### 3.1 Teljes menükatalógus

Az ADR szerinti resourceok SPA menüben (schema-driven list/edit ahol elég):

- Organizations
- Members
- Memberships
- Accounts
- Currencies (currency-type / rate / category ahogy indokolt)
- Receipts mint **önálló** resource (nem csak a tranzakció űrlap része)

### 3.2 Profil avatar

- Avatar feltöltés / megjelenítés a profil oldalon (v1: csak név, email, jelszócsere).

### 3.3 Receipt összekötés

- v1: 1:1 a felvételi flow-ban.
- v2: gazdagabb UI — egy receipt több tranzakcióhoz (séma: receipt → transactions oneToMany már létezik); meglévő receipt kiválasztása create közben.

### 3.4 Számla-allowlist konfiguráció

- v1: SPA hardcode (`5000|5100|5400`, `1xxx`).
- v2: konfigurálható allowlist (env, Strapi config, vagy admin által szerkeszthető lista), ne csak frontend konstans.

### 3.5 QA workflow erősítés

- Értesítés új draftokról
- Review sor / hozzárendelés
- Visszautasítás kötelező megjegyzéssel (ha üzletileg kell)

A rögzítő és a publikáló audit mező (`entered_by`, `published_by`, `createdAt`, `publishedAt`) a [v1 §9.5](./0001-content-backoffice-v1.md#95-audit-mezők) része. A publish őr az `editor` szerepen marad.

### 3.6 Könyvelési kör

A [domain use case-ek](../readme.md#use-cases) magja. A lista önmagában nem helyettesíti.

- Egyenleg és előzmény tagonként, illetve projektenként; a boardnak összesítve. Az egyenleg előre számolt összesítés (szervezet, számla, pénznem, időszak), nem lista-soronként újraszámolt összeg.
- Ismétlődő tagdíj és ütemezett terhelés, idempotens futással: egy újrafuttatás nem dupláz sort.
- Kivonat- és számlatükör-import előnézettel és az elutasított sorok naplójával.
- A pénznem és az árfolyam a rögzítéskor rögzített érték a tranzakción. A későbbi törzsadat-változás a régi egyenleget nem írja át. A részletes adatmodell-megjegyzés a [readme](../readme.md#accounting-loop-before-new-domains) alatt van.

## 4. Hosting és CI/CD

### 4.1 Subdomain (opcionális)

- `backoffice.kor.fejlesztesek.hu` mellett vagy helyett a path-alapú `/backoffice` mellett.

### 4.2 GitHub Actions skeleton (javaslat)

v1 manuális deploy után v2-ben pipeline. Javasolt skeleton:

```yaml
# .github/workflows/content-backoffice.yml
name: content-backoffice

on:
  push:
    paths:
      - 'apps/content-backoffice/**'
      - 'package-lock.json'
      - '.github/workflows/content-backoffice.yml'
  pull_request:
    paths:
      - 'apps/content-backoffice/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npx nx build content-backoffice
        env:
          VITE_STRAPI_URL: ${{ vars.VITE_STRAPI_URL }}
      - uses: actions/upload-artifact@v4
        with:
          name: content-backoffice-dist
          path: apps/content-backoffice/dist

  # Opcionális: cPanel feltöltés stub — secret-ekkel, manuális approve után
  # deploy:
  #   needs: build
  #   if: github.ref == 'refs/heads/main'
  #   environment: production
  #   runs-on: ubuntu-latest
  #   steps:
  #     - uses: actions/download-artifact@v4
  #       with:
  #         name: content-backoffice-dist
  #     - name: Upload to cPanel (FTP/SFTP/rsync stub)
  #       run: echo "Configure deploy action (FTP credentials / SSH) here"
```

Megjegyzések:

- A pontos `nx build` target neve az app `project.json` szerint állítandó.
- A pipeline a build mellett a publish őrt is teszteli, mielőtt a `/backoffice` kikerül.
- Deploy job legyen `environment: production` + manuális approval, amíg a cPanel feltöltés stabil.
- Ne commitoljunk FTP jelszót; GitHub Secrets.

### 4.3 Üzemeltetési alap

- Strukturált log kérésazonosítóval, és hibagyűjtő a Strapi és az SPA oldalán is, hogy egy mentés utólag köthető legyen egy Neon- vagy cPanel-hibához.
- Health endpoint, és egy rövid üzemeltetési jegyzet: Neon backup, Cloudinary, env, seedelt számlakódok, smoke login `dataentry` és `editor` szereppel.
- Séma- és jogosultságváltozás csak kódból, a bootstrapból. Az Admin UI-n kattintott eltérés később nem reprodukálható.

## 5. Teljesítmény

Amíg az adat még kicsi, a lista- és jelentésút legyen olcsó.

- A lista lapozott, szűk mezőlistával: dátum, összeg, státusz, szervezet, debit és credit kód, bizonylat azonosító. A teljes `populate` a részletezőn marad.
- Index a szűrőoszlopokra: `date`, publikált státusz, szervezet, debit és credit számla. A Strapi draft és published párokat státuszszűrővel kéri az API.
- Árfolyam dátum szerint cache-elt lookup, nem soronkénti rate-lekérdezés. A rögzítéskori árfolyam a [§3.6](#36-könyvelési-kör) szerint a tranzakción van.
- A listában a bizonylat bélyegkép vagy link. Az eredeti fájl a Cloudinaryn marad, a részletező tölti le.
- Az SPA resource-onként töltődik. Az organizations, members és accounts képernyők nincsenek az első bundle-ben.

## 6. Auth bővítések (ha kell)

Ezek a könyvelési kör és az üzemeltetési alap után jönnek.

- További OAuth providerek a Google mellé (Users & Permissions).
- Invite email UX finomítás (sablon, lejárat, újraKüldés).
- Jelszó reset self-service a profil / login flow-ból (ha v1-ben nincs).

## 7. Priorizálási javaslat (nem kötelező sorrend)

1. Org–user ACL + szerveroldali szűrés
2. Strukturált log, hibagyűjtő, health endpoint, üzemeltetési jegyzet
3. CI: build és a publish őr tesztje; a deploy kézi jóváhagyásos marad
4. Allowlist configba, hogy számlatükör-változáskor ne kelljen új frontendet szállítani
5. Séma és jog csak kódból, bootstrapból
6. Lapozott lista, szűk mezők, indexek, bizonylat bélyegkép, resource-onkénti bundle
7. Előre számolt egyenleg, rögzítéskori árfolyam, cache-elt rate lookup
8. Tag- és projektegyenleg, ismétlődő tagdíj, import előnézettel
9. Receipt N:1 UI, majd a QA sor (értesítés, hozzárendelés, visszautasítás megjegyzéssel)
10. Csak utána: menükatalógus, user–member összerendelés, avatar, további OAuth, jelszó-reset, meghívó, subdomain

## 8. Kapcsolat a v1 DoD-hoz

A v2 elemek **nem** részei a [v1 Definition of Done](./0001-content-backoffice-v1.md#12-sikerkritérium-definition-of-done)-nak. Új PRD / ticket vágás a v1 ship után.
