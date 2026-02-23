#!/usr/bin/env node
/**
 * Generate random secrets for Strapi deployment
 * Usage: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

function generateSecret() {
  return crypto.randomBytes(32).toString('base64');
}

function generateAppKeys() {
  return Array.from({ length: 4 }, () => generateSecret()).join(',');
}

console.log('\n🔐 Strapi Environment Variables for Render:\n');
console.log('Copy these to your Render environment variables:\n');
console.log(`APP_KEYS=${generateAppKeys()}`);
console.log(`API_TOKEN_SALT=${generateSecret()}`);
console.log(`ADMIN_JWT_SECRET=${generateSecret()}`);
console.log(`TRANSFER_TOKEN_SALT=${generateSecret()}`);
console.log(`JWT_SECRET=${generateSecret()}`);
console.log('\n✅ Secrets generated! Copy these to Render dashboard.\n');


