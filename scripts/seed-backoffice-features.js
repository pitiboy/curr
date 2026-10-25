#!/usr/bin/env node

/**
 * Upsert Settings collection rows from an instance seed file (insert-only for existing keys).
 *
 * Usage:
 *   node scripts/seed-backoffice-features.js kor
 *   node scripts/seed-backoffice-features.js edizone
 */

const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const {
  resolveBackofficeFeaturesSeedPath,
  upsertBackofficeFeaturesFromFile,
} = require('../database/seeders/backoffice-features.js');

async function main() {
  const instance = process.argv[2]?.trim();
  if (!instance) {
    console.error('Usage: node scripts/seed-backoffice-features.js <kor|edizone>');
    process.exit(1);
  }

  const seedPath = resolveBackofficeFeaturesSeedPath(instance);
  console.log(`🌱 Settings seed: ${seedPath}`);

  const { createStrapi } = require('@strapi/strapi');
  const app = await createStrapi({
    distDir: path.resolve(__dirname, '..', 'dist'),
    autoReload: false,
    serveAdminPanel: false,
    env: process.env.NODE_ENV || 'development',
  });

  await app.load();

  try {
    await upsertBackofficeFeaturesFromFile(app, seedPath);
    console.log('✅ Settings seed finished');
  } finally {
    await app.destroy();
  }
}

main().catch((error) => {
  console.error('❌ Settings seed failed:', error);
  process.exit(1);
});
