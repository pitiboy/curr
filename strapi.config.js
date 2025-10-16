/**
 * Strapi configuration for monorepo deployment
 * This file makes the root directory compatible with Strapi Cloud
 */

const path = require('path');

module.exports = {
  // Point to the actual Strapi app directory
  appPath: path.join(__dirname, 'apps', 'backend-strapi'),

  // Export the Strapi configuration from the actual app
  getConfig: () => {
    const appPath = path.join(__dirname, 'apps', 'backend-strapi');
    return require(path.join(appPath, 'config', 'server.js'));
  },
};
