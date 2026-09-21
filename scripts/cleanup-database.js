#!/usr/bin/env node

/**
 * Database cleanup script for CURR Strapi application
 * This script removes all accounts and organizations from the database
 */

const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    confirm: false,
    dryRun: false,
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
🧹 CURR Database Cleanup

Usage: node scripts/cleanup-database.js [options]

Options:
  --confirm           Confirm deletion (required for actual cleanup)
  --dry-run          Show what would be deleted without actually deleting
  --help, -h         Show this help message

Examples:
  node scripts/cleanup-database.js --dry-run
  node scripts/cleanup-database.js --confirm
`);
      process.exit(0);
    }
  }

  return options;
}

async function runCleanup() {
  const options = parseArgs();

  console.log('🧹 Starting CURR database cleanup...');
  console.log('📋 Configuration:');
  console.log(`   Dry Run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log(`   Confirmed: ${options.confirm ? 'Yes' : 'No'}`);

  if (!options.dryRun && !options.confirm) {
    console.error(
      '❌ Error: You must use --confirm to actually delete data or --dry-run to see what would be deleted'
    );
    console.log('💡 Use --help for more information');
    process.exit(1);
  }

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

    console.log('📊 Strapi instance loaded, starting cleanup...');

    // Get counts before cleanup
    const accountCount = await app.entityService.count('api::account.account');
    const organizationCount = await app.entityService.count(
      'api::organization.organization'
    );

    console.log('📈 Current data:');
    console.log(`   Accounts: ${accountCount}`);
    console.log(`   Organizations: ${organizationCount}`);

    if (options.dryRun) {
      console.log('🔍 DRY RUN - No data will be deleted');
      console.log('💡 Use --confirm to actually delete the data');
    } else {
      console.log('🗑️  Starting deletion...');

      // Delete all accounts first (they depend on organizations)
      if (accountCount > 0) {
        console.log('🗑️  Deleting accounts...');
        const accounts = await app.entityService.findMany(
          'api::account.account',
          {
            limit: -1, // Get all
          }
        );

        for (const account of accounts) {
          await app.entityService.delete('api::account.account', account.id);
        }
        console.log(`✅ Deleted ${accounts.length} accounts`);
      }

      // Delete all organizations
      if (organizationCount > 0) {
        console.log('🗑️  Deleting organizations...');
        const organizations = await app.entityService.findMany(
          'api::organization.organization',
          {
            limit: -1, // Get all
          }
        );

        for (const organization of organizations) {
          await app.entityService.delete(
            'api::organization.organization',
            organization.id
          );
        }
        console.log(`✅ Deleted ${organizations.length} organizations`);
      }

      // Verify cleanup
      const finalAccountCount = await app.entityService.count(
        'api::account.account'
      );
      const finalOrganizationCount = await app.entityService.count(
        'api::organization.organization'
      );

      console.log('📊 Final counts:');
      console.log(`   Accounts: ${finalAccountCount}`);
      console.log(`   Organizations: ${finalOrganizationCount}`);

      if (finalAccountCount === 0 && finalOrganizationCount === 0) {
        console.log('✅ Database cleanup completed successfully!');
      } else {
        console.log('⚠️  Some data may still remain');
      }
    }

    // Give a moment for pending operations to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Close the app
    await app.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runCleanup();
}

module.exports = { runCleanup };
