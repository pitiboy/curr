#!/usr/bin/env node
const crypto = require('crypto');

const random = () => crypto.randomBytes(32).toString('base64');

const appKeys = [random(), random(), random(), random()].join(',');

process.stdout.write(
  [
    `APP_KEYS=${appKeys}`,
    `API_TOKEN_SALT=${random()}`,
    `ADMIN_JWT_SECRET=${random()}`,
    `TRANSFER_TOKEN_SALT=${random()}`,
    `JWT_SECRET=${random()}`,
    `ENCRYPTION_KEY=${random()}`,
    '',
  ].join('\n')
);
