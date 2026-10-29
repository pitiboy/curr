# Bulk quantity entry workflows

Reusable **bulk quantity entry** for deal-style forms: one shared date and one numeric input per child organization under a configured parent org. Each non-zero row becomes its own draft `transaction` via the normal content-backoffice data provider.

Optional **distribution** (second wizard step) allocates the day’s total quantity to members of a configured organization. The egg daily entry workflow uses this; other resources (fruit, pigs) can reuse the same config shape.

## Member ↔ organization

Members are **not** linked to organizations directly. The **`membership`** collection connects them:

- `membership.organization` — which org (for eggs: `Tyúktartás`, constant `DISTRIBUTION_MEMBER_ORG` in `configs/eggDailyEntry.config.ts`)
- `membership.member` — the member record (with `account` / `private_account`)
- `membership.membership_type` — role/type; default egg rules live on `membership_type.rules`, overridable on `membership.rules`

Distribution lists memberships valid on the form date (`valid_from` / `valid_to`).

## Add a new production-only workflow

1. Create a config module under `configs/`, exporting a `BulkQuantityWorkflowConfig`:

   - `workflowId` — must match a **Settings** row with that `key` and `enabled: true` (seed per instance under `database/seeders/http/<instance>/data/backoffice-features.json`).
   - `parentOrganizationName` — exact name of the parent organization whose **direct children** are listed as quantity rows.
   - `currencyCode`, `debitAccountCode`, `creditAccountCode`, `transactionTypeName` — resolved from Strapi master data at runtime.
   - `descriptionKey` — i18n key with `%{organization}` and `%{amount}` placeholders.
   - `path`, `labelKey`, `roles` — menu route, menu label, and allowed roles.

2. Register the form in `workflows/registry.ts`:

   ```tsx
   element: <BulkQuantityEntryPage config={myConfig} />,
   ```

3. Add Hungarian and English strings under `app.workflows.<id>` and `app.bulk_quantity.description.<slug>` in `src/i18n/hu.ts` and `en.ts`.

4. Extend unit tests in `logic.test.ts` / `distributionLogic.test.ts` for any new pure helpers; keep registry and server workflow list tests in `workflows.test.ts`.

## Add distribution to a workflow

Set `distribution` on `BulkQuantityWorkflowConfig` (`BulkQuantityDistributionConfig`):

- `memberOrganizationName` — list memberships here
- `bookingOrganizationName` — `transaction.organization` on distribution legs (egg: same poultry org)
- Account codes and transaction type names for internal vs sale legs
- Egg rules key is `egg` on membership / membership-type `rules` JSON

Sale revenue currency: `app.egg_sale_currency` setting or `saleCurrency` in the workflow row’s `config` JSON (default `HUF`).

Pure logic: `logic.ts`, `distributionLogic.ts`, `membershipRules.ts`. Plans: `distributionPlans.ts`. Loaders: `loadCatalog.ts`, `loadDistribution.ts`. UI: `BulkQuantityEntryPage.tsx` (wizard when `distribution` is set).

## Egg daily entry constants

See `configs/eggDailyEntry.config.ts`: production `1300`/`4500`; distribution `internal` one leg `1001` ← `1300` (EGG); `sale` three legs — `1001` ← `1300` (EGG), `1000` ← `1001` (HUF, `Készpénz`), listán `1000` → `4000` bevétel (HUF, `Átvezetés`; tartozik `4000`, követel `1000`).
