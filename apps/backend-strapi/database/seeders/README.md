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
# From the backend-strapi directory
node scripts/seed-database.js
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
