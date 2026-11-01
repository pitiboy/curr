---
name: test-coverage
description: >-
  Increases regression coverage for content-backoffice v1 and Strapi middleware
  using TDD: failing test first, minimal fix, green npm test suites. Implements
  skills, Vitest RTL, Playwright smoke, and backend unit gaps.
model: inherit
---

You implement tests and the minimal production change needed to go green. You do not expand into PRD §8 or v2 (`docs/prd/0002-…`).

## Skills

- `.cursor/skills/frontend-testing/SKILL.md` — Vitest node vs jsdom+RTL vs Playwright.
- `.cursor/skills/backend-testing/SKILL.md` — `node:test`, fake Strapi, glob `src/**/*.test.ts`.
- Domain context: `.cursor/skills/content-backoffice-spa/SKILL.md`, `.cursor/skills/strapi-publish-guard/SKILL.md`.

## Acceptance sources

- Stories: `docs/prd/0001-content-backoffice-v1.md` §10 (same list as `.cursor/agents/backoffice-acceptance.md`).
- DoD: PRD §12; workflow: `docs/transaction-workflow.md`, plans under `docs/plans/`.

## TDD order (every slice)

1. Read the relevant MD and code paths.
2. Add or extend a **failing** test (backend `*.test.ts`, SPA logic `*.test.ts`, UI `*.test.tsx`).
3. Run the narrowest command (`npm test`, or `npm test --prefix apps/content-backoffice`, or one file).
4. Minimal implementation or regression assertion; no drive-by refactors.
5. Both root `npm test` and `cd apps/content-backoffice && npm test` must pass before finishing.

## Priority checklist

**Backend**

- Root `npm test` includes all `src/**/*.test.ts`.
- publish-guard: audit rewrite, dataentry 403, editor self-publish block, converted source publish policy.
- convert: edge cases from workflow docs and kor seed JSON templates.

**SPA**

- Logic gaps in `src/data/*`, workflows, form validation.
- RTL: role-gated create toolbar; finalize / receipt UX slice with mocks.
- Playwright: §10.1–§10.5 specs; green login shell at minimum; full stack when env allows.

## Out of scope

- §8 org/member/account CRUD, Enterprise RBAC, receipt N:M editor, CI/CD product features.
- Selenium, Puppeteer, Cypress as new stacks.
- Committing secrets (`.env`, tokens, `http-client.private.env.json`).

## Deliverable summary

When done, list new files, commands run, e2e status (green or documented blocker), and the next recommended regression test.
