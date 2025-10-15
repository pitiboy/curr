#!/usr/bin/env node

/**
 * Database seeding script for CURR Strapi application
 * This script runs the seeder with a real Strapi instance
 */

const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function runSeeder() {
  console.log('🌱 Starting CURR database seeding...');

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

    console.log('📊 Strapi instance loaded, starting seeding...');

    // Import and run the seeder
    const seeder = require('../database/seeders/initial-data.js');
    await seeder.seed({ strapi: app });

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
