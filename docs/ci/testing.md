# Testing pyramid (v1)

## Backend unit

```bash
npm ci
npm test
```

Uses `node --test` on `src/**/*.test.ts` without booting Strapi.

## Backoffice unit + RTL

```bash
npm ci --prefix apps/content-backoffice
cd apps/content-backoffice && npm test
```

Vitest runs `*.test.ts` in `node` and `*.test.tsx` in `jsdom` (Testing Library).

Root CI: `npm run ci:backoffice` (build, oxlint, vitest).

## Playwright (optional, local-first)

Install browsers once:

```bash
npx playwright install chromium
```

**Login shell (no API):** builds the SPA and opens the login route on `vite preview` (`playwright.config.ts` uses `http://127.0.0.1:4173/backoffice/` so Chromium does not resolve `localhost` to IPv6 while the server listens on IPv4 only).

```bash
npm run test:e2e -- --grep "login shell"
```

**Full stack (@full-stack):** requires Strapi on sqlite, seeded `dataentry` / `editor` users, and env copied from `.env.e2e.example` → `.env.e2e` (never commit). `playwright.config.ts` and `e2e/global-setup.ts` load `.env.e2e` so worker processes see `E2E_*` (not only the config process). Otherwise export vars manually:

```bash
set -a && source .env.e2e && set +a   # optional if the file exists
npm run dev                           # Strapi (1337)
npm run dev:f                         # Vite backoffice (5173)
npm run test:e2e -- --grep "@full-stack"
```

Specs in `e2e/backoffice-roles.spec.ts` cover dataentry menu gates, readonly list, editor review/finalize UI, and discard presence. They **skip** when `E2E_DATAENTRY_EMAIL` or `E2E_STRAPI_URL` is unset (typical cloud VM without a seeded stack), or when `E2E_BACKOFFICE_URL`’s host:port is closed (e.g. you ran `npm run test:e2e` without `npm run dev:f` — the login shell tests use Playwright’s preview on another port). Prefer **`127.0.0.1` in `E2E_BACKOFFICE_URL`** if you hit odd localhost/IPv6 behaviour; the reachability check normalizes `localhost` to IPv4.

**All tests (`npm run test:e2e`):** without Vite on 5173, `@full-stack` is skipped, not failed; use `--grep "login shell"` for preview-only smoke.

**Blockers:** no Google OAuth in e2e (email/password only); publish success is not asserted when seed `entered_by` would block same-person finalize.

Playwright is **not** part of lefthook or the mandatory CI jobs in `.github/workflows/ci.yml`.
