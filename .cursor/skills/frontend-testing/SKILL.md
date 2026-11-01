---
name: frontend-testing
description: >-
  Vitest node unit tests, Vitest jsdom + Testing Library for fragile React Admin
  UI, and Playwright smoke for content-backoffice. Use when adding or fixing
  apps/content-backoffice tests, RTL, i18n selectors, or e2e specs.
---

# Frontend testing (content-backoffice)

Scope: v1 backoffice SPA only (`apps/content-backoffice`). Not PRD §8, not v2.

## Which runner

| Layer | Tool | Files | When |
| ----- | ---- | ----- | ---- |
| Pure logic | Vitest, `environment: 'node'` | `**/*.test.ts` | data helpers, URL builders, workflow match, form validation |
| UI slice | Vitest + `jsdom` + `@testing-library/react` + `user-event` | `**/*.test.tsx` | Role-gated toolbar, finalize CTA, receipt hints |
| Smoke / acceptance | Playwright | repo `e2e/*.spec.ts` | Login shell, draft create, publish UI gates (needs stack) |

Do **not** use Playwright for helpers that belong in node Vitest. Do **not** add Cypress, Puppeteer, or Selenium.

## Vitest layout

- Config: `apps/content-backoffice/vitest.config.ts` — two projects: `node` (existing `*.test.ts`) and `jsdom` (`*.test.tsx`).
- DOM setup: `src/test/setupVitestDom.ts` imports `@testing-library/jest-dom/vitest`.
- Run: `cd apps/content-backoffice && npm test` (also via root `npm run ci:backoffice`).

## RTL conventions

- Prefer `getByRole`, `getByLabelText`, and visible Hungarian copy from `src/i18n/hu.ts` (default locale).
- Mount the **smallest** component that encodes the behavior; mock `dataProvider`, `authProvider`, and hooks (`usePermissions`, `useTranslate`) instead of full `<Admin>`.
- React Admin: stub heavy widgets (`SaveButton`, `ReferenceInput`) with simple buttons/labels when testing gates only.
- One or two assertions per smoke: visibility, disabled state, missing publish/convert control.

## Playwright

- Config: `/workspace/playwright.config.ts`, specs under `/workspace/e2e/`.
- Script: root `npm run test:e2e` (not lefthook, not required CI job).
- **Green without Strapi:** `webServer` builds and runs `vite preview`; login smoke checks Hungarian login UI (§10.1 shell).
- **Full stack (local):** Strapi sqlite + seed + `npm run dev:f`, set env from `.env.e2e.example`, then run tagged specs (`@full-stack`). See `docs/ci/testing.md`.

### E2E blocker note (cloud / CI)

OAuth and seeded users are not available on every cloud VM. When the stack cannot start, keep Playwright config + local-first specs; document prerequisites in `docs/ci/testing.md` rather than failing mandatory CI.

## How to run locally

```bash
# Unit (node)
cd apps/content-backoffice && npm test

# UI (jsdom) — same command, vitest projects pick *.test.tsx
cd apps/content-backoffice && npm test

# E2E login shell (preview only)
npm run test:e2e -- --grep "login shell"

# E2E full stack (after Strapi seed + .env.e2e)
npm run test:e2e -- --grep "@full-stack"
```

See also `docs/ci/testing.md`.
