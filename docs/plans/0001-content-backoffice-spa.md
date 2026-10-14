# Terv 0001: Content backoffice SPA

**Status:** in progress  
**PRD:** [0001-content-backoffice-v1](../prd/0001-content-backoffice-v1.md)  
**ADR:** [0001-react-admin-content-ui](../adr/0001-react-admin-content-ui.md)  
**Skill:** `.cursor/skills/content-backoffice-spa/SKILL.md`

A sorrend a skill bekötési sorrendje. Az agent a saját sorait pipálja. A **Human** sornál megáll; a következő lépést nem kezdi el. A PRD §12 checklistet az acceptance subagent után a Human pipálja.

## 1. Vite app scaffold

- [x] `apps/content-backoffice` Vite + React + TypeScript, a gyökér Strapi apptól elválasztva
- [x] Nx `project.json`: `serve`, `build`, `typecheck`
- [x] Függőségek: `react-admin` 5, `ra-strapi`, MUI (a react-admin peerjei szerint)
- [x] `vite.config.ts` `base: '/backoffice/'`, dev port `8080`
- [x] `.env.example`: `VITE_STRAPI_URL` (origin, path nélkül)
- [x] Minimális `<Admin>` héj `strapiAuthProvider` + `LoginWithEmail`; resource és guesser nincs
- [x] `nx build content-backoffice` / `npm run build` zöld
- [ ] **Human:** `nx serve content-backoffice` — a login héj a `http://localhost:8080/backoffice/` címen megjelenik; a `VITE_STRAPI_URL` a helyi Strapi origin (`http://localhost:1337`)

## 2. Provider: documentId, jogosultság, Google

- [ ] `withDocumentId` wrapper a getOne/update/delete `id` és a válaszrekord `documentId` mezőjére; teszt, ha az `ra-strapi` már így adja (no-op)
- [ ] Reláció referencia értéke is `documentId`
- [ ] `authProvider.getPermissions`: `/api/users/me?populate=role` → role `type` (`dataentry` | `qa`)
- [ ] Google: Strapi `/api/connect/google` flow; a Content JWT ugyanoda kerül, ahová a `strapiAuthProvider` a local tokent írja
- [ ] Dataentry írás queryje `status=draft`
- [ ] **Human:** local login JWT-vel belép; Google gomb a loginon van (éles callback később)

## 3. Szerepkörös tranzakció-oldalak

- [ ] Egy resource: `transactions`. Éles fában nincs `ListGuesser` / `EditGuesser` / `ShowGuesser`
- [ ] `dataentry`: `/transactions/create` (mentés draft, Publish nincs) + readonly `/transactions`
- [ ] `qa`: `/transactions/review` (csak draft, Publish) + readonly `/transactions`
- [ ] Menü a szerep szerint; ismeretlen szerep egyik író oldalt sem kapja
- [ ] Create/review mezők: `date`, `amount`, `description`, `organization`, `debit_account`, `credit_account`, opcionális `receipt`
- [ ] Lista szűrők: `status`, `date` tartomány, `amount`, `organization`, `debit_account`, `credit_account`, `description`
- [ ] A readonly listáról nincs create, edit, publish
- [ ] **Human:** dataentry nem látja a review route-ot; qa nem kap create menüpontot

## 4. Számlakód-szűrés

- [ ] Debit választó: `account.code` ∈ `5000`, `5100`, `5400` (kliens szűrés)
- [ ] Credit választó: `code` illeszkedik `^1`-re (seed: legalább `1000`, `1100`; `1200`/`1300` bent marad)
- [ ] Üres selectnél nincs csendes lista-bővítés más kódokkal
- [ ] **Human:** seedelt környezetben a debit/credit select a fenti kódokat mutatja

## 5. Receipt feltöltés

- [ ] Tranzakció receipt nélkül menthető
- [ ] Csatoláskor: `POST /api/upload` (Content JWT, `files` mező), receipt create `?status=draft`, `vendor` lehet üres
- [ ] Review: dokumentum link/előnézet; lista: receipt oszlop
- [ ] **Human:** draft tranzakció receipttel és anélkül is menthető

## 6. Profil és i18n

- [ ] `/profile`: név, email (`GET /api/users/me`)
- [ ] Jelszócsere csak `provider === 'local'` (`POST /api/auth/change-password`)
- [ ] `i18nProvider`: default `hu`, `en` katalógus a repóban; RA + saját címkék mindkettőben
- [ ] **Human:** UI magyar; Google-only fióknál a jelszó űrlap rejtett

## 7. Deploy path

- [ ] `vite build` `dist` a `kor.fejlesztesek.hu/backoffice` statikus fájljai
- [ ] Lépés dokumentálva a `docs/deploy/` alatt, a cPanel alias jegyzet mellett. CI nincs.
- [ ] **Human:** a `/backoffice/` path töltődik; az API ugyanaz az origin
