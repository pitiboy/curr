'use strict';

/**
 * CJS entry for local tooling. Strapi bootstrap imports
 * `src/backoffice-features/seed` (compiled into `dist`), so production
 * no longer needs this path on the server.
 *
 * Requires a prior `npm run build`.
 */
module.exports = require('../../dist/src/backoffice-features/seed.js');
