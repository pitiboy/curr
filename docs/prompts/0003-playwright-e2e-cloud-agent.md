# Cloud agent prompt: Playwright e2e bővítés (content-backoffice)

Másold be a felhő agentnek a **Feladat** szekciótól a végéig (vagy az egész fájlt). Branchen dolgozz; ne force-pusholj; ne commitolj secretet (`.env`, `.env.e2e`, token, `http-client.private.env.json`).

## Feladat

Bővítsd a Playwright e2e suite-ot a content-backoffice v1 acceptance (§10) alapján. Cél: több **stabil smoke**, ami a szerepkörös belépést, draft felvitelt, publish UI tiltást, editor review pathot és a magyar login shellt regresszióvédi — anélkül, hogy a kötelező CI jobokat megtörnéd.

Ez **implementáló** feladat: speceket írsz/módosítasz `e2e/` alatt, szükség esetén finomítod a `playwright.config.ts`-t és a `docs/ci/testing.md` howto-t. **Ne** írj új feature-t a SPA-ba vagy a Strapi API-ba, hacsak egy e2e blockerhez kell egy apró, teszt-only javítás (pl. hiányzó `data-testid` helyett először próbáld a meglévő magyar i18n / `getByRole` / label szelektorokat).

Scope: **v1** backoffice. **Nem** PRD §8, **nem** v2.

## Kontextus (repo állapot)

- SPA: `apps/content-backoffice` (React Admin 5, `ra-strapi`, base `/backoffice`).
- E2E: repo-root `e2e/*.spec.ts`, config: `playwright.config.ts`, script: root `npm run test:e2e`.
- Meglévő specek (`e2e/backoffice-smoke.spec.ts`):
  - **login shell** (Strapi nélkül): magyar email mező + Google gomb — `webServer` → Vite build + `preview:e2e` (§10.1 shell).
  - **`@full-stack`**: dataentry login → `/transactions/create` → van Mentés, nincs Véglegesít (§10.2 / §10.4 UI). Skip, ha nincs `E2E_DATAENTRY_EMAIL` / `E2E_STRAPI_URL`.
- Env minta: `.env.e2e.example` → másold `.env.e2e`-be lokálisan / VM-en (ne commitold).
- Skill: `.cursor/skills/frontend-testing/SKILL.md`. Howto: `docs/ci/testing.md`.
- Acceptance: `docs/prd/0001-content-backoffice-v1.md` §10 + `.cursor/agents/backoffice-acceptance.md` (readonly ellenőrzéshez).
- Playwright **nincs** a lefthookban és **nincs** a kötelező `.github/workflows/ci.yml` jobokban — így is maradjon, hacsak a felhasználó / külön ticket nem kéri a CI bekötést.
- Unit / RTL (Vitest) már létezik a törékeny UI szeletekre — **ne** ismételd Playwrightben a pure helper / kis komponens teszteket.

## Cloud VM / környezet szabályok

1. Böngésző: futtasd egyszer `npx playwright install chromium` (Linux VM-en szükség szerint `npx playwright install --with-deps chromium`).
2. **Zöld minimum (kötelező a DoD-hoz):** a Strapi nélküli login shell specek fussonak (`npm run test:e2e -- --grep "login shell"`).
3. **Full stack:** csak ha a VM-en elindítható Strapi (sqlite) + seedelt `dataentry` / `editor` user + Vite (`dev:f` vagy a config szerinti preview) + kitöltött `.env.e2e`. Ha **nem** áll fel a stack (nincs DB, seed, OAuth, port):
   - a `@full-stack` specek maradjanak `test.skip`-elhetőek env hiányában (meglévő minta);
   - **ne** tedd kötelező CI-be;
   - dokumentáld a blocker / előfeltételt `docs/ci/testing.md`-ben.
4. Ne függj Google OAuth-tól a specekben: local email/jelszó a `.env.e2e` userekkel. A Google **gomb láthatósága** a login shellben elég (§10.1).
5. Production / cPanel szerverre **ne** telepíts Playwright böngészőt — ez csak local / CI / cloud agent VM.

## Stack (kötelező)

- **Playwright** only (`@playwright/test`). Tilos: Cypress, Puppeteer, Selenium.
- Szelektor: `getByRole`, `getByLabelText`, látható magyar szöveg (`apps/content-backoffice/src/i18n/hu.ts`). Kerüld a törékeny CSS class / XPath szelektorokat.
- Tageld a speceket: `login shell` vs `@full-stack` (grep-barát). Új describe/tag konzisztens legyen a meglévővel.
- Egy spec = egy acceptance szelet; 1–3 assertion smoke, ne end-to-end form kitöltés minden mezőre, ha a lényeg a szerepkör / menü / CTA gate.

## Prioritásos specek (checklist)

Meglévő:

- [x] §10.1 shell: magyar email + Google entry (preview)
- [x] §10.2 / §10.4 UI: dataentry create — Mentés van, Véglegesít nincs (`@full-stack`)

Új (ezt szállítsd; a full-stackeket skipeld env nélkül):

1. **§10.1 menü dataentry (`@full-stack`)**  
   Belépés után: menüben Új tranzakció + Tranzakciók lista; **Ellenőrzés** menüpont nincs.

2. **§10.5 editor review belépés (`@full-stack`)**  
   Editor login → Ellenőrzés (vagy draft-szűrt lista) elérhető; draft soron / show-n látszik a **Véglegesít** (vagy a finalize szekció). Ne assertálj sikeres publishot, ha a seed `entered_by` same-person tiltást okozna — elég a CTA jelenléte + dataentry-nél a hiány.

3. **§10.6 readonly lista (`@full-stack`)**  
   dataentry (vagy editor) → tranzakció lista betölt; nincs szerkesztés gomb / Edit route CTA a listán (a repo UI mintájához igazítva).

4. **§10.8 i18n shell (Strapi nélkül, ha megoldható)**  
   Login oldalon magyar copy (pl. Bejelentkezés / E-mail) — bővíthető a meglévő login shell describe-ben.

5. **§10.11 discard UI gate (`@full-stack`, ha a feature már a branchen van)**  
   Editor draft show: **Piszkozat törlése** látszik; dataentry show: nem. Ne futtasd le a tényleges törlést, hacsak determinisztikus seed + cleanup van; UI presence elég smoke-nak.

Opcionális (csak ha a stack stabil és gyors):

- Profil oldal betöltés (§10.7) — név/email látszik.
- Audit mezők megjelenése show-n (§10.10) — csak ha a seedelt rekord garantált.

**Ne** specezz:

- Google OAuth teljes redirect flow-t.
- Production deploy pathot (§10.9) — az manuális / FTP checklist.
- API 403 publish policy-t Playwrightből (az `node:test` / publish-guard unit dolga); UI tiltás elég.
- Egg inventory / riport / §8 / v2 képernyőket.

## Implementációs szabályok

1. Olvasd el: `frontend-testing` skill, `docs/ci/testing.md`, meglévő `e2e/backoffice-smoke.spec.ts`, PRD §10, releváns SPA layout/menu (`BackofficeMenu`, transaction pages).
2. Új speceket tedd `e2e/` alá — vagy bővítsd a smoke fájlt, vagy szedd szét pl. `e2e/backoffice-login.spec.ts`, `e2e/backoffice-roles.spec.ts` ha átláthatóbb; ne duplikáld a configot.
3. Full-stack: használd `E2E_BACKOFFICE_URL`, `E2E_*_EMAIL` / `PASSWORD`, `E2E_STRAPI_URL` a `.env.e2e.example` szerint. Ha Playwright nem tölti automatikusan a `.env.e2e`-t, dokumentáld (`dotenv` / `export $(cat …)` / howto) — ne hardcode-olj jelszót.
4. `webServer`: a login shell maradjon preview-alapú; full-stack specek mehetnek külön base URL-re (mint most), ne törd el a Strapi nélküli zöld pathot.
5. Flaky ellen: várj role/locator visible-re; kerüld a rögzített `waitForTimeout`-ot.
6. Frissítsd `docs/ci/testing.md`-t az új grep példákkal / előfeltételekkel.
7. Ha kell, egy mondat a `frontend-testing` skill Playwright szekciójában az új tagekről.

## Definition of Done

- [ ] ≥2 új, értelmes acceptance smoke (a fenti checklistből), tagelve
- [ ] `npm run test:e2e -- --grep "login shell"` **zöld** a cloud VM-en (`playwright install` után)
- [ ] `@full-stack` specek: zöldek, ha `.env.e2e` + Strapi+SPA fut; különben tiszta skip + dokumentált előfeltétel
- [ ] Nincs secret a commitban; Playwright nincs kötelező CI/lefthook pathra kötve
- [ ] Nincs Cypress/Puppeteer/Selenium; nincs §8 / v2 scope
- [ ] Összefoglaló: új specek listája, futtatott parancsok + eredmény, full-stack zöld vagy blocker

## Olvasandó források (priority)

1. `docs/prd/0001-content-backoffice-v1.md` §10 / §12
2. `.cursor/skills/frontend-testing/SKILL.md`
3. `docs/ci/testing.md`
4. `e2e/backoffice-smoke.spec.ts`, `playwright.config.ts`, `.env.e2e.example`
5. `apps/content-backoffice/src/layout/BackofficeMenu.tsx`
6. `apps/content-backoffice/src/pages/transactions/*` (create, list, review, finalize, discard)
7. `apps/content-backoffice/src/i18n/hu.ts`
8. `.cursor/agents/backoffice-acceptance.md`

## Munkarend

1. `npx playwright install chromium` (+ deps ha kell).
2. Futtasd a meglévő login shell speceket — legyen zöld baseline.
3. Írd meg / bővítsd a speceket prioritás szerint.
4. Full-stack: csak ha a VM-en feláll a stack; különben skip + howto.
5. Frissítsd a docs/skill howto-t.
6. Commitolj csak ha a cloud / felhasználói szabály kéri; különben listázd a diffet az összefoglalóban.

## Összefoglaló a végén

Adj rövid listát: új/módosított fájlok, futtatott e2e parancsok + pass/fail/skip, full-stack elérhető volt-e, következő ajánlott e2e (ha maradt gap a §10-ből).
