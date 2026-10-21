/**
 * static-page router
 *
 * Core Content API under /api/static-pages. The public HTML pages at
 * /static and /static/:slug are registered in src/static-pages.ts.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::static-page.static-page');
