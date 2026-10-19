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

## Transaction import (kor)

`http/common/transactions.http` loads the rows of the "Pénzmozgások" Excel sheet
from `http/kor/data/transactions.json` as draft transactions. It is not part of
the `0*.http` run; start it on its own after the 01-08 seeders:

```bash
npm run seed:http:kor:transactions -- local
npm run seed:http:kor:transactions -- prod
```

Each row keeps its Excel columns. The mapping tables at the top of the JSON
(`partyAccounts`, `operationCreditAccounts`, `expenseDebitAccounts`,
`placeTransactionTypes`, `projectOrganizations`) turn them into accounts, type
and organization; anything that does not map stays empty for review before
publishing.

### Member accounts in account columns

Every member has two accounts, created automatically by the member lifecycle
(and backfilled on boot for existing members):

- `account`: code 1101, `<identifier> - tagi számla` (member account)
- `private_account`: code 1001, `<identifier> - saját számla` (the member's own,
  informal "homály" pocket)

Wherever the seeder expects an account name (the mapping tables, or a row's own
`credit_account` / `debit_account`, which takes precedence), a member account
can be given as `tag:<identifier>` (1101) or `saját:<identifier>` (1001), e.g.
`tag:kovács.erika`. The seeder looks the member up by identifier and uses the
linked account. An unknown member or a missing account leaves the relation
empty, with one log line per reference and the number of rows it affects.

### Duplicate protection: `import_key`

Every row in the JSON carries an `import_key`, computed from the fields listed
in the top-level `import_key_fields` array of `transactions.json`:

```json
"import_key_fields": ["currency", "date", "amount", "payer", "payee", "project"]
```

```
excel:<first 20 hex of sha256(the values of import_key_fields, in that order)>
```

`currency` is the file's `currencyCode` (or a row's own `currency`); every other
name must be a column that every row has, otherwise the key script stops with an
error. Strings are trimmed and whitespace-collapsed, the amount is formatted
with two decimals. The Excel row number is never part of the key. Rows with the
same key get `#2`, `#3`... in file order, so both still import (currently three
such pairs: rows 81/84, 127/128, 151/152). The seeder looks up each row by
`import_key`, skips it when it exists, and stores it on create. A second run
therefore creates nothing.

- **Reordering is safe.** Inserting, deleting or sorting rows does not
  re-import anything.
- **Only the six key fields count.** Editing `description`, `purpose`,
  `ledger`, `operation` or `place` keeps the key, so the row is not imported
  again (the change does not reach Strapi either; fix it in the backoffice).
- **Changing a key field creates a new key.** If you change currency, date,
  amount, payer, payee or project and regenerate the keys, the row imports as a
  _new_ transaction and the old one stays in Strapi. Fix such rows in the
  backoffice instead, or delete the old draft before re-running.
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
that marker and an empty `import_key`; the seeder finds them by the marker and
backfills their `import_key` with a PUT instead of creating a duplicate. Run it
once after deploying the schema change, before the Excel rows are reordered.

In the database, `src/transaction-import-key.ts` creates a partial unique index
on the draft rows (`transactions_import_key_draft_uq`, Postgres and SQLite) on
every boot. Strapi's own `unique: true` is not checked for drafts, and a plain
unique index would clash with the published copy of the same document. With the
index, a concurrent second run cannot insert the same key; the seeder treats
that failed create as "already imported". Manual transactions leave
`import_key` empty and are not affected.
