# Cloud agent prompt: TDD / test coverage

## Feladat

Állítsd fel a repo tesztpiramisát, írj project skilleket és egy TDD agentet, majd növeld a lefedettséget a meglévő dokumentáció és kód alapján. A cél: a törékeny UI, Strapi middleware és workflow viselkedés ne essen szét észrevétlenül.

Ez **implementáló** feladat: fájlokat létrehozol és módosítasz, teszteket futtatsz, CI/lefthook scriptet bekötöd. Branchen dolgozz; ne force-pusholj; ne commitolj secretet (`.env`, token, `http-client.private.env.json`).

## Kontextus (repo állapot)

- Monorepo: Strapi API a gyökérben, SPA: `apps/content-backoffice`.
- Backend tesztek: `node --test` + `--experimental-strip-types`, `package.json` → `"test"`. Minták: `src/publish-guard.test.ts`, `src/transaction-workflow/convert.test.ts`. **Strapi boot nélkül**, fake doubles.
- SPA tesztek: Vitest 3, `environment: 'node'`, csak pure-logic `*.test.ts`. Nincs RTL, jsdom, Playwright.
- CI: `.github/workflows/ci.yml` — `npm test` (Strapi), `npm run ci:backoffice` (build + lint + vitest).
- Lefthook: `lefthook.yml` — staged változáskor `npm test` / backoffice `npm test`.
- HttpYac seederek (`database/seeders/http/`) seeding / manuális ops, **nem** CI unit.
- Acceptance forrás: `docs/prd/0001-content-backoffice-v1.md` §10 / §12; agent minta: `.cursor/agents/backoffice-acceptance.md` (readonly).
- Meglévő skillek: `.cursor/skills/content-backoffice-spa/`, `.cursor/skills/strapi-publish-guard/`.
- Scope: **v1** backoffice + publish-guard + transaction-workflow. **Nem** PRD §8, **nem** v2 (`docs/prd/0002-…`).

## Stack (kötelező)

```text
PRD / plans / skills
        ↓
  test-coverage agent (TDD)
        ↓
  ┌─────────────────┬──────────────────┬────────────────────┐
  │ Backend         │ SPA logic        │ SPA UI / E2E       │
  │ node:test       │ Vitest node      │ Vitest jsdom+RTL   │
  │ fake Strapi     │ meglévő *.test.ts│ + Playwright smoke │
  └─────────────────┴──────────────────┴────────────────────┘
```

- **Backend:** marad `node --test`. Ne bootolj Strapit CI unitban. Kövesd a `publish-guard` fake-Strapi mintát.
- **SPA logic:** Vitest `node` — data/helpers/workflows.
- **SPA UI:** Vitest + `jsdom` + `@testing-library/react` + `@testing-library/user-event` csak törékeny React Admin interakciókra.
- **E2E:** **Playwright** only. **Tilos:** Selenium, Puppeteer, Cypress új stackként.
- **HttpYac:** marad seed; ne add CI unitnak, hacsak külön, assert-alapú API smoke nem készül (opcionális, nem kötelező DoD).

## TDD workflow (minden slice)

1. Olvasd el a releváns MD-t és a kódot (`docs/prd/0001-…`, `docs/plans/*`, `docs/transaction-workflow.md`, `.cursor/skills/*`).
2. Fogalmazz acceptanceből **először** failing / hiányzó tesztet.
3. Futtasd a megfelelő suite-ot.
4. Minimális implementáció vagy regressziós teszt a már létező bugra; ne refaktorálj scope-on kívül.
5. `npm test` és `apps/content-backoffice` `npm test` legyen zöld; CI pathon fusson az új unit/RTL.

Nem cél a 100% line coverage. Cél: publish policy, audit mezők, workflow convert, role-gated UI, receipt kötelező mezők, draft create.

## Szállítandó artifactok

### A) Skillek

Hozd létre (project skills, angol `name` / fájlnevek, magyar vagy angol body — a meglévő skillek stílusához igazodva):

1. `.cursor/skills/frontend-testing/SKILL.md`
   - Frontmatter: `name: frontend-testing`, `description` triggerrel (Vitest, RTL, Playwright, content-backoffice tesztek).
   - Mikor: Vitest node vs jsdom+RTL vs Playwright.
   - Selector: `getByRole` / label; magyar i18n stringek a UI-ból.
   - React Admin: kis slice mount, mock `dataProvider` / `authProvider`; ne e2e-zz minden form mezőt.
   - Hol ne Playwright: pure helper, URL builder, filter logic → unit.

2. `.cursor/skills/backend-testing/SKILL.md`
   - Frontmatter: `name: backend-testing`, trigger: Strapi middleware, publish-guard, convert, `src/*.test.ts`.
   - `node:test` + `node:assert/strict` minták.
   - Fake Strapi / Document Service middleware tesztelés.
   - `package.json` `test` script glob: legyen benne `src/**/*.test.ts` **vagy** explicit lista, hogy `src/backoffice-features/parse.test.ts` is fusson (ma a `src/*.test.ts` kihagyja).
   - Mit ne: teljes Strapi boot CI unitban; ne függj élő DB-től unitban.

### B) Agent

Hozd létre: `.cursor/agents/test-coverage.md`

- Frontmatter: `name: test-coverage`, `model: inherit`, **ne** `readonly` (implementál).
- Description: lefedettség növelés, regressziós tesztek, új backoffice/middleware feature TDD-je.
- Body: TDD sorrend; hivatkozd a `frontend-testing` és `backend-testing` skilleket; acceptance bizonyítékforrás a `backoffice-acceptance` §10 storylista és a PRD.
- Scope tiltás: §8 / v2.

### C) Tooling scaffold

**SPA (kötelező CI-ben):**

- `apps/content-backoffice`: telepítsd `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` (devDependencies).
- Vitest: node + jsdom (projects / külön environment fájlonként). Setup fájl `jest-dom` matcherekhez.
- Legalább **1–2** RTL smoke: pl. role-gated publish/review CTA; receipt kötelező mező / create form slice. Preferáld a kis, mockolt komponenst a teljes Admin mount helyett, ha az utóbbi törékeny.

**Playwright:**

- Config: `apps/content-backoffice` **vagy** repo-root `e2e/` — válassz egyet, dokumentáld.
- Script: pl. root vagy app `test:e2e`.
- `webServer` ha megoldható (Strapi sqlite + Vite `/backoffice/`); különben dokumentáld a manuális `dev` + `dev:f` előfeltételt.
- Test user / env: példa `.env.e2e.example` **secret nélkül**; ne commitolj valódi tokent.
- Legalább **1** zöld Playwright smoke, ha a cloud VM-en fel tudod állítani a stacket. Ha blocker van (nincs DB/seed/OAuth), írj rövid blocker jegyzetet a skillbe vagy `docs/ci/` alá, de a config + legalább egy skippelt/placeholder helyett inkább dokumentált local-first smoke speceket adj §10.1–§10.5-re (login, draft create, dataentry publish UI tiltás, editor review path).

**CI / scripts:**

- `ci:backoffice` futtassa a Vitest suite-ot (RTL benne) — már `npm run test --prefix apps/content-backoffice`.
- Playwright: **külön** CI job vagy local-only script. Ne törd el a meglévő kötelező checkeket. Ha e2e CI még nem stabil: script + howto elég; unit+RTL kötelező.
- Lefthook: ne futtass Playwrightet minden commiton; unit/RTL maradjon a meglévő pattern szerint.
- Gyökér `npm test` glob javítás (`parse.test.ts`).

**Docs:**

- Rövid howto a frontend vagy backend skillben (vagy `docs/ci/` egy rövid MD): hogyan futtasd unit / RTL / e2e lokálisan.

## Prioritásos lefedettség (checklist)

Backend (először):

- [ ] `npm test` tartalmazza `src/backoffice-features/parse.test.ts`-t
- [ ] publish-guard: audit rewrite, dataentry 403 publish, editor self-publish tiltás, converted source ahol a kód/docs indokolja
- [ ] `transaction-workflow/convert`: edge case-ek `docs/transaction-workflow.md` és `database/seeders/http/kor/data/transaction-workflows/*.json` alapján

SPA:

- [ ] Logic: workflow match / draft / publish / list filter helper bővítés ahol gap van
- [ ] RTL: TransactionCreate vagy review show — szerepkör szerinti CTA
- [ ] Playwright: §10.1–§10.5 smoke (legalább config + specek; zöld futtatás ahol env engedi)

## Definition of Done

- [ ] `.cursor/skills/frontend-testing/SKILL.md` és `.cursor/skills/backend-testing/SKILL.md` létezik
- [ ] `.cursor/agents/test-coverage.md` létezik (implementáló)
- [ ] RTL deps + vitest jsdom setup; ≥1 RTL teszt zöld
- [ ] Playwright config + specek; ≥1 zöld e2e **vagy** dokumentált blocker + local howto
- [ ] `npm test` és `cd apps/content-backoffice && npm test` zöld
- [ ] Új unit/RTL a CI pathon; Playwright nem rontja a kötelező jobokat
- [ ] Nincs secret a commitban; nincs v2 / §8 scope; nincs Selenium/Puppeteer

## Olvasandó források (priority)

1. `docs/prd/0001-content-backoffice-v1.md` (§9–§12)
2. `docs/adr/0001-react-admin-content-ui.md`
3. `docs/plans/0001-content-backoffice-spa.md`, `docs/plans/0003-transaction-workflow-backoffice.md`
4. `docs/transaction-workflow.md`, `docs/plans/0002-transaction-workflow-content-type.md`
5. `.cursor/skills/content-backoffice-spa/SKILL.md`, `.cursor/skills/strapi-publish-guard/SKILL.md`
6. `.cursor/agents/backoffice-acceptance.md`
7. `src/publish-guard.ts` + `.test.ts`, `src/transaction-workflow/*`
8. `apps/content-backoffice/src/pages/transactions/*`, `apps/content-backoffice/src/data/*`
9. `.github/workflows/ci.yml`, `lefthook.yml`, gyökér és app `package.json`

## Munkarend

1. Skillek + `test-coverage` agent.
2. Backend glob fix + prioritásos unit tesztek.
3. SPA Vitest/RTL scaffold + smoke.
4. Playwright scaffold + smoke / blocker doc.
5. CI/lefthook/scripts igazítás.
6. Futtasd a teszteket; javítsd a pirosakat.
7. Commitolj csak ha a felhasználó / cloud szabályok kérik; különben hagyd staged-re kész állapotban és összefoglalóban listázd a változásokat.

## Összefoglaló a végén

Adj rövid listát: létrehozott fájlok, futtatott parancsok + eredmény, e2e zöld vagy blocker, következő ajánlott regressziós teszt.
