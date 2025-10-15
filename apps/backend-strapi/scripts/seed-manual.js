#!/usr/bin/env node

/**
 * Manual seeding script - run this in Strapi console
 * Copy and paste the code below into Strapi console
 */

console.log(`
🌱 Manual Seeding Instructions:

1. Start Strapi: npm run dev
2. Open Strapi console: npm run console
3. Copy and paste the following code:

// ===== COPY FROM HERE =====
const seeder = require('./database/seeders/initial-data.js');
await seeder.bootstrap({ strapi });
console.log('✅ Seeding completed!');
// ===== COPY TO HERE =====

This will seed your database with initial data.
`);

// Also provide the seeding code as a separate file for easy copying
const fs = require('fs');
const path = require('path');

const seedCode = `
// CURR Database Seeding Code
// Copy and paste this into Strapi console

const seeder = require('./database/seeders/initial-data.js');
await seeder.bootstrap({ strapi });
console.log('✅ Seeding completed!');
`;

fs.writeFileSync(path.join(__dirname, 'console-seed-code.js'), seedCode);
console.log('📄 Seeding code saved to: scripts/console-seed-code.js');
console.log('💡 You can also copy from that file if needed.');
