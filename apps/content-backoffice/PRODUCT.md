# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are organizational operators on the Content API (Users & Permissions), not Strapi Admin:

- **dataentry** — records draft transactions and related content; cannot publish.
- **editor** — reviews drafts, attaches receipts where allowed, publishes, and may discard drafts.
- **controller** — wider operational control (e.g. asset category write, reconciliation-style reports, destructive actions gated in UI).

They work in Hungarian-first UI during real bookkeeping sessions: enter and check double-entry rows, run workflow forms, maintain asset inventory, and read operational reports. Member self-service is out of scope for this SPA’s product record.

## Product Purpose

`content-backoffice` is the organization’s cockpit for community resource accounting. It replaces day-to-day use of the Strapi Content Manager for operators: same host as the API (`/backoffice`), Content JWT only.

Success means an operator can complete entry → review → publish (and related workflows/assets/reports) without Admin JWT or schema tooling, while draft/publish and audit rules stay enforced by the API.

## Positioning

Operator-facing React Admin on `ra-strapi` against a Strapi 5 Content API that already models multi-currency double-entry (ügylet vs transaction line), org-scoped assets, and role-gated publish — not a generic CMS admin and not a member wallet app.

## Operating Context

- Deployed beside Strapi at `/backoffice` (local Vite `base` `/backoffice/`; production e.g. `https://kor.fejlesztesek.hu/backoffice`).
- Auth: email/password and Google against Content users; no `/admin/login` in the SPA.
- Core loops: transaction create (always draft for dataentry), readonly list + show, editor finalize/discard on drafts; transaction-workflow convert/collect-asset handoff; asset list/create/edit/show; feature-flagged reports and bulk workflow forms.
- Strapi Admin remains the developer/ops content-type surface.
- Domain language: ügylet (business event) vs transaction (one debit–credit line); organization as project node; debit/credit accounts; receipt optional on transactions.

## Capabilities and Constraints

- Stack is fixed: Vite + React Admin 5 + MUI + `ra-strapi`; react-admin `id` is Strapi `documentId`.
- Menus and routes are feature- and role-gated via backoffice config / gates; not every Content type is exposed as a menu.
- v1 product contract for transactions/receipts/roles lives in `docs/prd/0001-content-backoffice-v1.md` and workspace backoffice-v1 scope rules; broader CURR platform and v2 PRD items are not this file’s authority.
- Org visibility and asset org-scope follow current API middleware (assets are org-scoped for dataentry/editor).
- Undecided for this record: member-facing products; any accessibility standard beyond default MUI/RA behavior.

## Brand Commitments

- Product family names in docs: **CURR** / **KÖR**; the SPA chrome title uses Settings `appTitle` (deploy-specific, often KÖR) plus translated `app.title` (“Kezelő felület”).
- UI copy is Hungarian-first; English catalog is maintained.
- Incumbent theme cue: brand green aligned with https://zoldeletprogram.hu/ (see `src/theme.ts`); not a license to invent a new marketing brand system here.

## Evidence on Hand

- Product/IA: `docs/prd/0001-content-backoffice-v1.md`, ADR `docs/adr/0001-react-admin-content-ui.md`.
- Domain: `docs/readme.md`, `docs/transaction-workflow.md`, plans under `docs/plans/` (e.g. assets `0010-eszkoznyilvantartas.md`).
- Runnable SPA: `apps/content-backoffice/`; API schemas under `src/api/**/content-types/**/schema.json`.
- Seeded workflows and sample org data: `database/seeders/http/`.
- Do not fabricate testimonials, customer logos, benchmarks, or pricing for this product.

## Product Principles

1. **Task over chrome** — every screen exists so an operator finishes a concrete bookkeeping or review job.
2. **API truth wins** — draft/publish, roles, org scope, and audit are server rules the UI must honor, not redecorate.
3. **One vocabulary** — keep ügylet / transaction / organization / account language consistent with the ledger model.
4. **Hungarian workplace default** — labels and flows assume HU operators first; EN stays parallel, not primary.
5. **Strapi Admin stays out of the cockpit** — this SPA never becomes the Content-Type Builder or Admin JWT surface.
