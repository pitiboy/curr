# CURR / KÖR

Közösségi erőforrás-nyilvántartás: Strapi 5 API a repó gyökerében, kettős könyvvitel (debit/credit), több pénznem (pénz, idő, tojás, stb.). Az **ügylet** az üzleti esemény, a **transaction** egy debit–credit sor.

## Térkép

- `src/api/<content-type>/` – Strapi content type-ok (séma: `content-types/*/schema.json`). Fő domain: `transaction`, `transaction-workflow`, `receipt`, `account`, `currency-*`, `member`, `organization`.
- `src/components/workflow/` – workflow komponensek.
- `src/transaction-workflow/` – Convert / preview logika (ügylet kifejtése több sorra).
- `src/backoffice-features/`, `src/publish-guard.ts`, `src/publish-policy.ts`, `src/index.ts` (`register`/`bootstrap`: Document Service middleware, szerepek).
- `config/` – Strapi konfig (`plugins.ts`: users-permissions, Google provider).
- `database/migrations/` – időbélyeges Strapi migrációk.
- `database/seeders/http/` – httpyac seederek: `common/*.http` + adat `edizone/data`, `kor/data` (pl. `transaction-workflows/*.json`).
- `apps/content-backoffice/` – Vite + React Admin 5 + ra-strapi SPA (`/backoffice/`), saját `package.json`.
- `e2e/` – Playwright.
- `docs/` – index: [docs/readme.md](docs/readme.md). PRD: `docs/prd/`, ADR: `docs/adr/`, tervek: `docs/plans/000N-*.md`, ügyletek: `docs/transaction-workflow.md`.

## Generált fájlok – ne szerkeszd kézzel

- `types/generated/*` – Strapi generálja; forrás: `src/api/**/content-types/**/schema.json`.
- `src/extensions/documentation/**` – documentation plugin generálja.
- Cursor Agent: `.cursorignore` + rule `strapi-generated-artifacts`; lefthook Prettier kihagyja a generált útvonalakat.

## Parancsok

```bash
npm run develop          # Strapi :1337
npm run dev:all          # Strapi + backoffice (nx)
npm run typecheck
npm test                 # node:test, src/**/*.test.ts
npm run test:seeders     # database/seeders/*.test.mjs
npm run test:e2e         # Playwright
npm test --prefix apps/content-backoffice    # vitest
npm run lint --prefix apps/content-backoffice # oxlint
npm run seed:help
```

## Szabályok

- Pre-commit (lefthook): prettier, typecheck, tesztek. Minden létrehozott vagy módosított `js,ts,tsx,json,md,yml,yaml,css,html` fájlra futtasd a repó gyökeréből: `npx prettier --write <fájlok>` (kivéve `package-lock.json`).
- Új teszt a meglévő mintát követi: backend `node:test` fake Strapi-val, backoffice Vitest.
- Domain-specifikus szabályok skillekben: `content-backoffice-spa`, `strapi-publish-guard`, `backend-testing`, `frontend-testing` (forrás: `.cursor/skills/`, symlinkelve `.claude/skills/` alá). Cursor rule-ok: `.cursor/rules/`.
