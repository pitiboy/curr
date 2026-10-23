# Bulk quantity entry workflows

Reusable **bulk quantity entry** for deal-style forms: one shared date and one numeric input per child organization under a configured parent org. Each non-zero row becomes its own draft `transaction` via the normal content-backoffice data provider.

## Add a new workflow

1. Create a config module under `configs/`, for example `fruitHarvest.config.ts`, exporting a `BulkQuantityWorkflowConfig`:
   - `workflowId` — must appear in `KNOWN_BACKOFFICE_WORKFLOWS` (`src/api/backoffice/workflows.ts`) and in the target instance `BACKOFFICE_WORKFLOWS` env when it should be enabled by default.
   - `parentOrganizationName` — exact name of the parent organization whose **direct children** are listed as quantity rows.
   - `currencyCode`, `debitAccountCode`, `creditAccountCode`, `transactionTypeName` — resolved from Strapi master data at runtime.
   - `descriptionKey` — i18n key with `%{organization}` and `%{amount}` placeholders.
   - `path`, `labelKey`, `roles` — menu route, menu label, and allowed roles.

2. Register the form in `workflows/registry.ts`:

   ```tsx
   element: <BulkQuantityEntryPage config={myConfig} />,
   ```

3. Add Hungarian and English strings under `app.workflows.<id>` and `app.bulk_quantity.description.<slug>` in `src/i18n/hu.ts` and `en.ts`.

4. Extend unit tests in `logic.test.ts` for any new pure helpers; keep registry and server workflow list tests in `workflows.test.ts`.

Pure logic lives in `logic.ts` (row building, duplicate filter shape, payload mapping, result merge). UI and HTTP are in `BulkQuantityEntryPage.tsx`, `loadCatalog.ts`, `duplicateFetch.ts`, and `saveRows.ts`.
