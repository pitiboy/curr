#!/usr/bin/env node

/**
 * Database seeding script for CURR Strapi application
 * This script runs the seeder with a real Strapi instance
 */

const path = require('path');
const fs = require('fs');

async function runSeeder() {
  console.log('🌱 Starting CURR database seeding...');

  try {
    // Import Strapi
    const { createStrapi } = require('@strapi/strapi');

    // Create Strapi instance
    const app = await createStrapi({
      distDir: path.resolve(__dirname, '..', 'dist'),
      autoReload: false,
      serveAdminPanel: false,
    });

    await app.load();

    console.log('📊 Strapi instance loaded, starting seeding...');

    // Import and run the seeder
    const seeder = require('../database/seeders/initial-data.js');
    await seeder.bootstrap({ strapi: app });

    console.log('✅ Seeding completed successfully!');

    // Close the app
    await app.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runSeeder();
}

module.exports = { runSeeder };
