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

**Login shell (no API):** builds the SPA and opens the login route on `vite preview`.

```bash
npm run test:e2e -- --grep "login shell"
```

**Full stack (@full-stack):** requires Strapi on sqlite, seeded users, and env copied from `.env.e2e.example` (no real secrets in git). Start Strapi and the Vite dev server, then:

```bash
npm run test:e2e -- --grep "@full-stack"
```

Playwright is **not** part of lefthook or the mandatory CI jobs in `.github/workflows/ci.yml`.
