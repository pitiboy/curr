import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import backofficeCacheMiddleware from './backoffice-cache';

describe('backoffice-cache middleware', () => {
  it('overrides Cache-Control after next()', async () => {
    const handler = backofficeCacheMiddleware({}, {
      strapi: { log: { info: () => undefined } },
    } as never);
    const headers: Record<string, string> = {
      'cache-control': 'public, max-age=60',
    };
    const ctx = {
      path: '/backoffice/index.html',
      set(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
    };
    await handler(ctx as never, async () => undefined);
    assert.equal(headers['cache-control'], 'no-cache');
  });

  it('does not set headers for API routes', async () => {
    const handler = backofficeCacheMiddleware({}, {
      strapi: { log: { info: () => undefined } },
    } as never);
    const headers: Record<string, string> = {};
    const ctx = {
      path: '/api/transactions',
      set(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
    };
    await handler(ctx as never, async () => undefined);
    assert.equal(headers['cache-control'], undefined);
  });
});
