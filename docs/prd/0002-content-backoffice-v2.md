# PRD 0002: Content Backoffice v2 (roadmap)

**Status:** draft  
**Date:** 2026-10-12  
**Product:** `content-backoffice`  
**Depends on:** [0001-content-backoffice-v1](./0001-content-backoffice-v1.md)  
**Related ADR:** [0001-react-admin-content-ui](../adr/0001-react-admin-content-ui.md)

## 1. Cél

Ez a dokumentum a v1-ből **szándékosan kihagyott** funkciókat gyűjti össze. Nem szállítható sprint-scope; prioritás és szeletelés a v1 élesítése után történik.

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
- Audit trail (Enterprise nélkül: saját mezők / log)

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
- Deploy job legyen `environment: production` + manuális approval, amíg a cPanel feltöltés stabil.
- Ne commitoljunk FTP jelszót; GitHub Secrets.

## 5. Auth bővítések (ha kell)

- További OAuth providerek a Google mellé (Users & Permissions).
- Invite email UX finomítás (sablon, lejárat, újraKüldés).
- Jelszó reset self-service a profil / login flow-ból (ha v1-ben nincs).

## 6. Priorizálási javaslat (nem kötelező sorrend)

1. Org–user ACL + szerveroldali szűrés (biztonság)
2. CI build + artifact; utána deploy stub
3. Menükatalógus bővítés resourceonként (schema-driven)
4. Receipt N:1 UI + allowlist konfiguráció
5. Avatar, QA értesítések, subdomain

## 7. Kapcsolat a v1 DoD-hoz

A v2 elemek **nem** részei a [v1 Definition of Done](./0001-content-backoffice-v1.md#12-sikerkritérium-definition-of-done)-nak. Új PRD / ticket vágás a v1 ship után.
