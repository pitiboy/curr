---
name: backend-testing
description: >-
  Strapi middleware and workflow unit tests with node:test, fake Strapi doubles,
  publish-guard, transaction-workflow convert, and src/**/*.test.ts. Use when
  adding backend tests or fixing the root npm test glob.
---

# Backend testing (Strapi repo root)

Scope: publish guard, transaction-workflow convert, backoffice-features parse, and other `src/**` pure logic. **No full Strapi boot** in unit tests. Not PRD §8, not v2.

## Runner

- `node --experimental-strip-types --test` with `node:assert/strict`.
- Root script: `npm test` — glob **`src/**/*.test.ts`** (includes nested paths such as `src/backoffice-features/parse.test.ts` and `src/transaction-workflow/convert.test.ts`).
- CI: `.github/workflows/ci.yml` job `strapi` runs `npm test` before production build.

## Fake Strapi pattern

Follow `src/publish-guard.test.ts`:

- Implement a minimal `PublishGuardStrapi` (or equivalent) with `documents.use`, `db.query`, `requestContext.get`.
- Drive Document Service middleware by capturing the registered handler and calling it with fake `uid`, `action`, `params`.
- Assert on thrown errors (`403`, `ValidationError`), mutated `params.data`, and side effects (`publish` on linked receipts).
- Import `@strapi/utils` only where the production code throws typed errors (requires root `npm ci`).

## transaction-workflow

- Pure functions in `src/transaction-workflow/convert.ts` — test match, expand, member 1101/1001 resolution, template placeholders, `pickMatchingWorkflow` 409.
- Use fixtures aligned with `docs/transaction-workflow.md` and `database/seeders/http/kor/data/transaction-workflows/*.json` (codes and step shapes, not HTTP).

## What not to do

- Do not start Strapi or hit a live DB in unit tests.
- Do not add HttpYac seed scripts to `npm test`; seeds stay manual/ops unless a separate assert-based API smoke is explicitly scoped.

## How to run

```bash
npm test
npm run typecheck
```

See `docs/ci/testing.md` for the full pyramid with SPA and e2e.
