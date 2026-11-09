import type { Core } from '@strapi/strapi';

import { WAKE_CACHE_CONTROL, WAKE_PATH, WAKE_READY_PATH } from './constants';

/**
 * Strapi-native wake routes (used when `strapi develop` / default `start` runs).
 * Production Passenger entry uses `server/wake-entry.js`, which answers wake
 * before `createStrapi().load()` finishes.
 *
 * Strapi only accepts GET/POST/PUT/PATCH/DELETE/ALL as route methods; HEAD is
 * answered automatically by @koa/router for every GET route.
 */
export function registerWakeRoutes(strapi: Core.Strapi): void {
  strapi.server.routes([
    {
      method: 'GET',
      path: WAKE_PATH,
      handler(ctx) {
        ctx.set('Cache-Control', WAKE_CACHE_CONTROL);
        ctx.status = 200;
        ctx.body = { ok: true, waking: true };
      },
      config: { auth: false },
    },
    {
      method: 'GET',
      path: WAKE_READY_PATH,
      handler(ctx) {
        ctx.set('Cache-Control', WAKE_CACHE_CONTROL);
        ctx.status = 200;
        ctx.body = { ready: true };
      },
      config: { auth: false },
    },
  ]);
}
