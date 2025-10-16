#!/usr/bin/env node

/**
 * Deployment script for Strapi Cloud
 * This script builds the Strapi app from the Nx monorepo
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Strapi deployment from Nx monorepo...');

try {
  // Change to the Strapi app directory
  const strapiDir = path.join(__dirname, 'apps', 'backend-strapi');

  if (!fs.existsSync(strapiDir)) {
    throw new Error(`Strapi directory not found: ${strapiDir}`);
  }

  console.log(`📁 Working in directory: ${strapiDir}`);

  // Install dependencies in the Strapi app
  console.log('📦 Installing dependencies...');
  execSync('npm install', {
    cwd: strapiDir,
    stdio: 'inherit',
  });

  // Build the Strapi application
  console.log('🔨 Building Strapi application...');
  execSync('npm run build', {
    cwd: strapiDir,
    stdio: 'inherit',
  });

  // Copy the built files to the root for Strapi Cloud
  console.log('📋 Copying built files to root...');
  const distDir = path.join(strapiDir, 'dist');
  const rootDistDir = path.join(__dirname, 'dist');

  if (fs.existsSync(distDir)) {
    // Remove existing dist in root if it exists
    if (fs.existsSync(rootDistDir)) {
      fs.rmSync(rootDistDir, { recursive: true, force: true });
    }

    // Copy dist to root
    execSync(`cp -r "${distDir}" "${rootDistDir}"`, { stdio: 'inherit' });

    // Copy package.json from Strapi app to root for runtime
    const strapiPackageJson = path.join(strapiDir, 'package.json');
    const rootPackageJson = path.join(__dirname, 'package.json');

    if (fs.existsSync(strapiPackageJson)) {
      const strapiPkg = JSON.parse(fs.readFileSync(strapiPackageJson, 'utf8'));
      const rootPkg = JSON.parse(fs.readFileSync(rootPackageJson, 'utf8'));

      // Merge the scripts and dependencies needed for runtime
      rootPkg.scripts = {
        ...rootPkg.scripts,
        start: 'cd apps/backend-strapi && npm start',
        develop: 'cd apps/backend-strapi && npm run develop',
      };

      // Add Strapi dependencies to root if not already present
      if (!rootPkg.dependencies) rootPkg.dependencies = {};
      Object.assign(rootPkg.dependencies, strapiPkg.dependencies);

      fs.writeFileSync(rootPackageJson, JSON.stringify(rootPkg, null, 2));
    }
  }

  console.log('✅ Strapi deployment completed successfully!');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
