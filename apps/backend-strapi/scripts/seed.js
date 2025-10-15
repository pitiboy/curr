#!/usr/bin/env node

/**
 * Seed script for CURR Strapi application
 * Run this script to populate initial data
 */

const path = require('path');
const fs = require('fs');

// Import the seeder
const seederPath = path.join(
  __dirname,
  '..',
  'database',
  'seeders',
  'initial-data.js'
);

if (!fs.existsSync(seederPath)) {
  console.error('❌ Seeder file not found:', seederPath);
  process.exit(1);
}

const seeder = require(seederPath);

// Mock Strapi object for seeding
const mockStrapi = {
  entityService: {
    findMany: async (uid, options = {}) => {
      console.log(`🔍 Mock findMany: ${uid}`, options);
      return [];
    },
    create: async (uid, data) => {
      console.log(`➕ Mock create: ${uid}`, data.data);
      return { id: Math.floor(Math.random() * 1000), ...data.data };
    },
  },
};

async function runSeeder() {
  console.log('🌱 Running CURR initial data seeder...');

  try {
    await seeder.bootstrap({ strapi: mockStrapi });
    console.log('✅ Seeding completed successfully!');
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
