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

A fájlok **verziókezelve maradnak** (CI `typecheck`). A `develop` / `npm run dev` gyakran újraírja őket → lokálisan zajos `git status`.

### Git: `skip-worktree` (opcionális, csak a saját gépen)

A jel **nem kerül a repóba** — csak az adott gépen él. Aktív skip esetén Git **figyelmen kívül hagyja** a working copy módosítását ezeken a trackelt fájlokon a `git status`-ban, amíg vissza nem kapcsolod. A Strapi továbbra is generál; más fejlesztőket nem érinti.

**Figyelem:** `skip-worktree` **nem** oldja meg a merge / pull / rebase / branch-váltás blokkolását. Ha a `develop` újraírta a fájlt a lemezen, Git továbbra is megáll („would be overwritten by merge”). Ilyenkor állítsd vissza a commitolt állapotra:

```bash
npm run git:reset-generated
```

(`scripts/reset-strapi-generated-git.sh`: no-skip → `git restore` HEAD-ről → skip újra.)

**Main merge (`mm`):** a repóban `npm run git:mm` (= `scripts/git-mm.sh`) futtat resetet az elején és a `git merge main` előtt is (futó `dev` közben is regenerálódhat). Cseréld a személyes `mm` aliast:

```bash
alias mm='npm run git:mm'
```

(csak a repó gyökeréből.)

**Érintett fájlok:**

- `types/generated/contentTypes.d.ts`
- `types/generated/components.d.ts`
- `src/extensions/documentation/documentation/1.0.0/full_documentation.json`

**Beállítás (új klón / másik gép):**

```bash
git update-index --skip-worktree \
  types/generated/contentTypes.d.ts \
  types/generated/components.d.ts \
  src/extensions/documentation/documentation/1.0.0/full_documentation.json
```

**Kikapcsolás** (séma / content type / documentation változás commitolása előtt — különben a friss generált állapot nem látszik `git status`-ban):

```bash
git update-index --no-skip-worktree \
  types/generated/contentTypes.d.ts \
  types/generated/components.d.ts \
  src/extensions/documentation/documentation/1.0.0/full_documentation.json
```

Ezután `git status`, `git add`, commit a generált frissítéssel. Ha megint csak a develop-zajt akarod elnyomni, futtasd újra a `--skip-worktree` blokkot.

**Ellenőrzés** (mely fájlokon van aktív jel):

```bash
git ls-files -v | grep '^S'
```

**Commit generált frissítéssel:** `bash scripts/reset-strapi-generated-git.sh skip-off` → status/diff → add/commit → opcionálisan `skip-on` vagy `npm run git:reset-generated`.

## Parancsok

```bash
npm run git:reset-generated  # merge/pull előtt: generált fájlok = HEAD (skip-worktree mellett is)
npm run git:mm               # main pull + merge (régi mm alias, reset beépítve)
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
