# Bulk quantity entry workflows

**Bulk quantity entry** wizard: one shared date and one numeric input per child organization under a configured parent org, with an optional second step that distributes the day's quantity to members. The egg daily entry (`/workflows/egg-production`) is the only user today.

## Saving: one backend request

The SPA no longer builds or writes transaction legs. On save the wizard sends **one** request to `config.entriesPath` (egg: `POST /api/egg-production/entries`):

```json
{
  "date": "2026-11-18",
  "productions": [
    { "organizationId": "<hen house documentId>", "quantity": 120 }
  ],
  "distributions": [{ "memberId": "<member documentId>", "quantity": 10 }],
  "conflictChoice": "skip | replace | add",
  "conflictChoices": { "<hen house documentId>": "skip" },
  "publish": false
}
```

The backend (`src/egg-production/`) builds production + pool transfer + distribution legs with the transaction-workflow engine (`expandWorkflowSteps`, dedicated templates), checks the `egg-production` feature flag, role and organization scope, detects duplicates, and writes every leg in **one DB transaction** — any failure leaves nothing behind. `?dryRun=1` returns the same plan without writing (preview).

UI flow (`BulkQuantityEntryPage.tsx`):

1. Save → one POST without a conflict choice.
2. `409 EGG_CONFLICT_CHOICE_REQUIRED` → conflict dialog (global with distribution, per hen house otherwise): **Meglévő sor frissítése** (`replace`), **Új sor felvétele** (`add`), **Meglévő sor megtartása** (`skip`) → the same body is sent again with the choice.
3. Success → inputs reset, per-row results (hen house / member: new, updated, kept, published) and server warnings are shown.
4. Any other error → error alert with the server message (Hungarian), inputs kept, **Mentés újrapróbálása** resends the same body.

Client modules: `eggEntriesApi.ts` (request/response types, error parsing, result summary), `logic.ts` (quantity parsing, request rows), `loadCatalog.ts` (hen houses), `loadDistribution.ts` (members + currency rates for display). Totals, rule and rate helpers are imported from the backend (`src/egg-production/distribution.ts`) so both sides use the same code.

## Auto-publish

The `egg-production` Settings row may set `config.initialPublicationStatus`: `"draft"` (default) or `"published"`. With `"published"` the wizard sends `publish: true`; the server re-checks the Setting and publishes every written leg inside the same DB transaction with the linked `eggAuto` context (`dataentry` may finalize, same person allowed). The manual list „Véglegesítés” and `POST /api/transactions/:id/actions/publish?eggAuto=1` are unchanged.

Layout: `layout: 'single'` (egg) shows production and distribution on one page; an empty distribution saves production only. Opt-in `voice: { enabled: true }` adds microphone dictation via `POST /api/transactions/parse-voice` with `workflowId` (fills hen-house + member quantities; saving stays manual).

## Member ↔ organization

Members are **not** linked to organizations directly. The **`membership`** collection connects them:

- `membership.organization` — which org (for eggs: `Tyúktartás`, `POULTRY_STOCK_ORGANIZATION_NAME` in `eggDailyEntry.constants.ts`, from `database/seeders/egg-poultry.constants.json`)
- `membership.members` — one or more member records (many-to-many; the backend uses `private_account` = `1001`)
- `membership.membership_type` — role/type; default egg rules live on `membership_type.rules`, overridable on `membership.rules`

`rules.egg = { mode: 'internal' | 'sale', ratio }` is resolved by the backend (`src/egg-production/membership-rules.ts`, with fallback by membership type name). The wizard only uses it to know whether a sale rate is needed.

## Egg legs (built by the backend)

Per hen house: production `1300` ← `4500` (EGG, hen house org), pool transfer `4500` ← `1300` on the hen house and `1300` ← `4500` on `Tyúktartás` (`Átvezetés`). Per member: `internal` one leg `1001` ← `1300` (EGG, `Tyúktartás`); `sale` three legs — `1001` ← `1300` (EGG), `1000` ← `1001` (sale currency, `Készpénz`), `4000` ← `1000` (sale currency, `Átvezetés`), amount = qty × ratio × EGG→sale rate. `related_transaction`: first production is the anchor, pool legs → own production, distribution legs → anchor. Undistributed stock stays on `1300`. Templates, endpoint and error codes: [docs/transaction-workflow.md](../../../../../docs/transaction-workflow.md#napi-tojás-endpoint-post-apiegg-productionentries).

## Add a new production-only workflow

A new resource needs a backend endpoint like `src/egg-production/` (templates + service); the wizard is reusable:

1. Create a config module under `configs/` exporting a `BulkQuantityWorkflowConfig` (`workflowId` = Settings key, `parentOrganizationName`, `currencyCode`, `entriesPath`, `path`, `labelKey`, `roles`, optional `distribution.memberOrganizationName`).
2. Register the form in `workflows/registry.tsx`: `element: <BulkQuantityEntryPage config={myConfig} />`.
3. Add Hungarian and English strings under `app.workflows.<id>` in `src/i18n/hu.ts` and `en.ts`.
4. Tests: `logic.test.ts`, `eggEntriesApi.test.ts`, `BulkQuantityEntryPage.test.tsx` (one request per save); backend `src/egg-production/*.test.ts`.
