import type { Core } from '@strapi/strapi';

import {
  createHomeRedirectMiddleware,
  resolveSiteHomeRedirectTarget,
} from '../legal-pages';

/**
 * Runs late in the global middleware stack (config/middlewares.ts), before the
 * Koa router. Strapi's strapi::public middleware registers GET `/` → admin;
 * this handler intercepts the same path first and sends users to the SPA.
 */
export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  const target = resolveSiteHomeRedirectTarget();
  if (!target) {
    return async (_ctx: unknown, next: () => Promise<unknown>) => next();
  }

  strapi.log.info(`Site root redirects to ${target}`);
  return createHomeRedirectMiddleware(target);
};
