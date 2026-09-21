#!/usr/bin/env node

/**
 * Database seeding script for CURR Strapi application
 * This script runs the seeder with a real Strapi instance
 */

const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    organizationName: 'Zöld források szövetkezet @Szupatak',
    childOrgLevel: 0,
    seedAccounts: false,
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--name' && args[i + 1]) {
      options.organizationName = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (arg === '--level' && args[i + 1]) {
      options.childOrgLevel = parseInt(args[i + 1]) || 0;
      i++; // Skip next argument as it's the value
    } else if (arg === '--accounts') {
      options.seedAccounts = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
🌱 CURR Organization Initializer

Usage: node scripts/seed-database.js [options]

Options:
  --name <name>        Organization name (default: "Zöld források szövetkezet @Szupatak")
  --level <0-3>        Child organization level (default: 0)
                       0 = No child organizations
                       1 = Vezetés level (4 organizations)
                       2 = Vezetés + Központok (10 organizations)
                       3 = Full structure (21 organizations)
  --accounts           Create Hungarian general ledger accounts
  --help, -h           Show this help message

Examples:
  node scripts/seed-database.js --name "My Coop" --level 2 --accounts
  node scripts/seed-database.js --name "Test Org" --level 1
  node scripts/seed-database.js --accounts
`);
      process.exit(0);
    }
  }

  return options;
}

async function runSeeder() {
  const options = parseArgs();

  console.log('🌱 Starting CURR organization initialization...');
  console.log('📋 Configuration:');
  console.log(`   Organization: ${options.organizationName}`);
  console.log(`   Child Level: ${options.childOrgLevel}`);
  console.log(`   Seed Accounts: ${options.seedAccounts ? 'Yes' : 'No'}`);

  // Debug: Check if environment variables are loaded
  console.log('🔍 Database config:', {
    client: process.env.DATABASE_CLIENT,
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    name: process.env.DATABASE_NAME,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD ? '***' : 'EMPTY',
  });

  try {
    // Import Strapi
    const { createStrapi } = require('@strapi/strapi');

    // Create Strapi instance
    const app = await createStrapi({
      distDir: path.resolve(__dirname, '..', 'dist'),
      autoReload: false,
      serveAdminPanel: false,
      env: process.env.NODE_ENV || 'development',
    });

    await app.load();

    console.log('📊 Strapi instance loaded, starting initialization...');

    // Import and run the seeder
    const seeder = require('../database/seeders/org-initializer.js');
    await seeder.initialize({
      strapi: app,
      organizationName: options.organizationName,
      childOrgLevel: options.childOrgLevel,
      seedAccounts: options.seedAccounts,
    });

    console.log('✅ Organization initialization completed successfully!');

    // Give a moment for pending operations to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Close the app
    await app.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runSeeder();
}

module.exports = { runSeeder };
