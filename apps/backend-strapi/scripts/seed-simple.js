#!/usr/bin/env node

/**
 * Simple database seeding script
 * Uses Strapi's built-in seeding capabilities
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🌱 Starting simple database seeding...');

try {
  // Change to the backend-strapi directory
  process.chdir(path.join(__dirname, '..'));

  // Run the seeder using Strapi's bootstrap
  const seederPath = path.join(
    __dirname,
    '..',
    'database',
    'seeders',
    'initial-data.js'
  );

  // Create a temporary script that loads Strapi and runs the seeder
  const tempScript = `
const { createStrapi } = require('@strapi/strapi');
const seeder = require('${seederPath}');

async function run() {
  const app = await createStrapi({
    distDir: './dist',
    autoReload: false,
    serveAdminPanel: false,
  });
  
  await app.load();
  await seeder.bootstrap({ strapi: app });
  await app.destroy();
  console.log('✅ Seeding completed!');
  process.exit(0);
}

run().catch(console.error);
`;

  // Write temporary script
  const fs = require('fs');
  const tempPath = path.join(__dirname, 'temp-seeder.js');
  fs.writeFileSync(tempPath, tempScript);

  // Run the temporary script
  execSync(`node ${tempPath}`, { stdio: 'inherit' });

  // Clean up
  fs.unlinkSync(tempPath);
} catch (error) {
  console.error('❌ Seeding failed:', error.message);
  process.exit(1);
}
