/**
 * legal-page router
 *
 * Core Content API under /api/legal-pages. The public HTML pages at
 * /legal and /legal/:slug are registered in src/legal-pages.ts.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::legal-page.legal-page');
