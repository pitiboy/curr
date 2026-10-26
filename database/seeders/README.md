# CURR Database Seeders

This directory contains database seeders for the CURR (Community Unified Resource Registry) system.

## Initial Data Seeder

The `initial-data.js` seeder automatically populates basic data when the database is empty:

### What it seeds:

1. **Organization** (1 entry)

   - Zöld források szövetkezet @Szupatak

2. **Account Categories** (5 entries)

   - Revenue (Green)
   - Expense (Red)
   - Asset (Blue)
   - Liability (Yellow)
   - Equity (Purple)

3. **Transaction Types** (6 entries)

   - Elrendelt (Planned expense)
   - Utalás (Bank transfer)
   - Készpénz (Cash payment)
   - Átvezetés (Internal transfer)
   - Jutalék (Commission)
   - Barter (Goods exchange)

4. **Currency Categories** (4 entries)

   - Cash 💰 (Traditional money currencies)
   - Labor ⏰ (Time and work-based currencies)
   - Resources 🌾 (Physical goods and materials)
   - Assets 🏠 (Property and equipment)

5. **Currency Types** (3 entries)
   - HUF (Hungarian Forint) - Cash category
   - EUR (Euro) - Cash category
   - HOUR (Labor Hour) - Labor category

## How to use:

### Manual seeding (recommended):

The seeder is now manual-only and does not run automatically.

#### Option 1: Using the seed script

```bash
# From the repository root
npm run seed
# or: node scripts/seed-database.js
```

#### Option 2: In Strapi console

```javascript
// Access the seeder
const seeder = require('./database/seeders/initial-data.js');
await seeder.seed({ strapi });
```

#### Option 3: Programmatically

```javascript
// In your own script
const seeder = require('./database/seeders/initial-data.js');
await seeder.seed({ strapi: yourStrapiInstance });
```

## Safety features:

- ✅ Only seeds if tables are empty
- ✅ Skips existing data
- ✅ Provides detailed logging
- ✅ Handles errors gracefully
- ✅ Uses proper Strapi entityService methods

## Customization:

Edit the `initial-data.js` file to:

- Add more seed data
- Modify existing entries
- Add new entity types
- Change the seeding logic

## Notes:

- The seeder uses Hungarian terms as specified in the requirements
- All enums match the schema definitions
- Relations are properly established between entities
- The seeder is idempotent (safe to run multiple times)

## Settings (kor / edizone)

Workflow toggles and backoffice settings live in the **Settings** collection (`key`, `enabled`, `config` JSON). Strapi Admin can edit them; the Content API exposes read-only values via `GET /api/backoffice/config`.

Instance seed files (httpyac, same pattern as 01–09):

- `database/seeders/http/common/10-backoffice-features.http`
- `database/seeders/http/kor/data/backoffice-features.json`
- `database/seeders/http/edizone/data/backoffice-features.json`

Upsert is **insert-only**: existing keys are left unchanged (Admin edits are preserved). Included in `seed:http:kor` / `seed:http:edizone`; or alone:

```bash
npm run seed:http:kor:backoffice-features:local
npm run seed:http:edizone:backoffice-features:local
npm run seed:http:kor:backoffice-features -- prod
```

Optional boot-time upsert (Strapi documents API, not httpyac): set `BACKOFFICE_FEATURES_INSTANCE=kor` (or `edizone`) in `.env`.

Setting keys use dotted prefixes (`content.`, `accounts.`, `app.`); any other `key` is treated as a workflow id for the backoffice menu. The SPA brand prefix is `app.title` (`config.value`, e.g. `KÖR`).

## HTTP seed (kor / edizone)

A `database/seeders/http/common/01`–`10` fájlok futnak az `npm run seed:http:kor:local` és `seed:http:edizone:local` parancsokkal. Az adat JSON-ok a `kor/data` és `edizone/data` mappákban vannak.

| Lépés | HTTP                                                                                                  | Adat                            |
| ----- | ----------------------------------------------------------------------------------------------------- | ------------------------------- |
| 09    | `common/09-currency-rates.http` (vagy `kor/09-currency-rates.http`, `edizone/09-currency-rates.http`) | `data/currency-rates.json`      |
| 10    | `common/10-backoffice-features.http`                                                                  | `data/backoffice-features.json` |

Előfeltétel a 09-hez: a 04-es pénznem seed (`currency-types.json`) már bent legyen.

## Transaction import (kor)

`http/common/transactions.http` loads the rows of the "Pénzmozgások" Excel sheet
from `http/kor/data/transactions.json` as draft transactions. It is not part of
the `0*.http` run; start it on its own after the 01-09 seeders:

```bash
npm run seed:http:kor:transactions -- local
npm run seed:http:kor:transactions -- prod
```

`transactions-reset.http` deletes only those imported documents, draft and
published. A row matches when `import_key` starts with `excel:` (including a
stale key from an earlier field list) or `entered_by` still has the file's
`keyPrefix` (`excel:Pénzmozgások#`). Manual transactions stay. Receipts stay;
a receipt that pointed at a deleted transaction keeps the receipt and loses
the link.

```bash
npm run seed:http:kor:transactions:reset:local
npm run seed:http:kor:transactions:reset -- prod
```

Each row keeps its Excel columns. `credit_Account` and `Debit_account` are the
booking: `transaction-import-keys.mjs` resolves them onto `accounts.json`
(or `tag:<identifier>` / `saját:<identifier>` for a member) and writes
`credit_account`, `debit_account`, `organization` and, when it maps,
`transaction_type`. Sheet labels that are not chart names are listed in
`ACCOUNT_ALIASES` in that script (`Lakó földterületek` → Belterületi
földterületek, `Földterületek` and `Gazdasági földterületek` → Mezőgazdasági
földterületek, `Pénztár - Saját számla` → Készpénz). `Organization/Projekt` is
used when it is an organization; `Zöld Élet Program` still goes to the main
organization. `Bányászás` is the transaction type even when the place is `K&H`.

The tables at the top of the JSON (`partyAccounts`, `operationCreditAccounts`,
`expenseDebitAccounts`, `placeTransactionTypes`, `operationTransactionTypes`,
`projectOrganizations`) are only the fallback for a row that has no resolved
account. Their targets have to be names in the final chart. Refresh the rows
from the workbook with:

```bash
node database/seeders/transaction-import-keys.mjs --xlsx "/path/to/Pénzmozgások.xlsx"
```

### Member accounts in account columns

Every member has two accounts, created automatically by the member lifecycle
(and backfilled on boot for existing members):

- `account`: code 1101, `<identifier> - tagi számla` (member account)
- `private_account`: code 1001, `<identifier> - saját számla` (the member's own,
  informal "homály" pocket)

Wherever the seeder expects an account name (the mapping tables, or a row's own
`credit_account` / `debit_account`, which takes precedence), a member account
can be given as `tag:<identifier>` (1101) or `saját:<identifier>` (1001). The
workbook's member labels are first names, so the resolved refs are `tag:pál`,
`saját:pál`, `tag:erika`, `saját:erika`, `tag:ildikó`, `tag:dani`, `tag:péter`,
`saját:péter` and `saját:laci`. The seeder looks the member up by that
identifier and uses the linked account. An unknown member or a missing account
leaves the relation empty, with one log line per reference and the number of
rows it affects.

### Duplicate protection: `import_key`

Every row in the JSON carries an `import_key`, computed from the fields listed
in the top-level `import_key_fields` array of `transactions.json`:

```json
"import_key_fields": ["currency", "date", "amount", "payer", "payee", "project"]
```

```
excel:<first 20 hex of sha256(the values of import_key_fields, in that order)>
```

`payee` is the sheet column Kinek fizettük, `project` is Organization/Projekt.
Rebuilding the file from the current workbook therefore changed the key of every
row whose payee or project text changed (155 of 185). If those old keys are
already in a database, run `npm run seed:http:kor:transactions:reset:local`
(or `-- prod`) before seeding again, otherwise they are inserted a second time.

`currency` is the file's `currencyCode` (or a row's own `currency`); every other
name must be a column that every row has, otherwise the key script stops with an
error. Strings are trimmed and whitespace-collapsed, the amount is formatted
with two decimals. The Excel row number is never part of the key. Rows with the
same key get `#2`, `#3`... in file order, so both still import (three pairs: rows 81/84, 127/128, 151/152). The seeder looks up each row by
`import_key`. When that draft exists, it PUTs the current JSON onto it: date,
amount, description, currency, accounts, transaction type, organization,
`entered_by`, and `import_key`. A relation the JSON no longer resolves is
cleared. Receipts and related transactions are not sent. A second run therefore
updates every matching draft and creates only keys that are not in the database
yet. The published copy stays as it was; publish the draft again after the
update.

- **Reordering is safe.** Inserting, deleting or sorting rows updates the same
  drafts. The `entered_by` marker follows the new Excel row number.
- **Only the six key fields identify the row.** Editing `description`,
  `purpose`, `ledger`, `operation`, `place`, or the resolved `credit_account` /
  `debit_account` / `organization` keeps the key, so the next
  `transactions.http` run writes those changes onto the existing draft.
  Backoffice edits of those fields are replaced by the JSON on the next run.
- **Changing a key field creates a new key.** If you change currency, date,
  amount, payer, payee or project and regenerate the keys, the row imports as a
  _new_ transaction and the old one stays in Strapi. Reset the imported drafts
  before re-running when that old row should go.
- **Do not change `import_key_fields` once rows are imported** on an
  environment. It changes every key, so the next run would import all rows
  again. If it must change, the existing `import_key` values in that database
  have to be rewritten (backfilled) to the new keys first.
- After changing `transactions.json`, regenerate the keys (the seeder refuses
  rows without a key or with a duplicate key):

  ```bash
  npm run seed:kor:transactions:keys
  node database/seeders/transaction-import-keys.mjs --check   # verify only
  ```

`entered_by` still holds `excel:Pénzmozgások#<row>`, but only as a readable
marker. Rows created by the earlier seeder (before `import_key` existed) have
that marker and an empty `import_key`; the seeder finds them by the marker,
writes the key, then updates the rest of the draft from the JSON instead of
creating a duplicate. Run it once after deploying the schema change, before the
Excel rows are reordered.

In the database, `src/transaction-import-key.ts` creates a partial unique index
on the draft rows (`transactions_import_key_draft_uq`, Postgres and SQLite) on
every boot. Strapi's own `unique: true` is not checked for drafts, and a plain
unique index would clash with the published copy of the same document. With the
index, a concurrent second run cannot insert the same key; the seeder finds
that draft and updates it from the JSON. Manual transactions leave
`import_key` empty and are not affected.
