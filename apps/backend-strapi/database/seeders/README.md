# CURR Database Seeders

This directory contains database seeders for the CURR (Community Unified Resource Registry) system.

## Initial Data Seeder

The `initial-data.js` seeder automatically populates basic data when the database is empty:

### What it seeds:

1. **Organization** (1 entry)

   - Zöld források szövetkezet @Szupatak

2. **Transaction Types** (8 entries)

   - Elrendelt (Planned expense)
   - Utalás (Bank transfer)
   - Készpénz (Cash payment)
   - Átvezetés (Internal transfer)
   - Jutalék (Commission)
   - Barter (Goods exchange)
   - Tagdíj (Membership fee)
   - Befizetés (Deposit)

3. **Divisions** (8 entries)

   - Management and Personnel Center
   - Communication Center
   - Promotion and Marketing Directorate
   - Records and Assets Management
   - Planning Center
   - Area Development
   - Production Management
   - Agriculture and Forestry

4. **Currency Types** (8 entries)
   - HUF (Hungarian Forint)
   - EUR (Euro)
   - HOUR (Labor Hour)
   - KG_WHEAT (Wheat)
   - CHICKEN (Chicken)
   - TRACTOR (Tractor)
   - ROOFTILE (Roof Tile)
   - WOOD (Wood)

## How to use:

### Automatic seeding (recommended):

The seeder runs automatically when Strapi starts if the database is empty.

### Manual seeding:

```bash
# From the backend-strapi directory
npm run seed
```

### In Strapi console:

```javascript
// Access the seeder
const seeder = require('./database/seeders/initial-data.js');
await seeder.bootstrap({ strapi });
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
