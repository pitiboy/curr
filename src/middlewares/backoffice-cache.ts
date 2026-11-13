import type { Core } from '@strapi/strapi';

import { backofficeCacheControlForPath } from '../backoffice-features/backoffice-cache-policy';

type CacheKoaContext = {
  path: string;
  set: (name: string, value: string) => void;
};

export default (_config: unknown, _ctx: { strapi: Core.Strapi }) => {
  return async (ctx: CacheKoaContext, next: () => Promise<unknown>) => {
    await next();
    const cacheControl = backofficeCacheControlForPath(ctx.path);
    if (cacheControl) {
      ctx.set('Cache-Control', cacheControl);
    }
  };
};
