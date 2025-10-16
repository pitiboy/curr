/**
 * Entry point for Strapi Cloud deployment
 * This file redirects to the actual Strapi app in the monorepo
 */

const path = require('path');

// Change to the Strapi app directory
process.chdir(path.join(__dirname, 'apps', 'backend-strapi'));

// Import and start the actual Strapi application
require('./src/index.js');
