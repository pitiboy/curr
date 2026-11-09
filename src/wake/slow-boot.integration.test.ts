import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';

import { handleEarlyRequest } from './http-handlers';

/**
 * Simulates wake-entry: immediate listener, delayed Strapi handler attachment.
 */
describe('slow-boot wake simulation', () => {
  it('wake responds before the main app handler exists', async () => {
    let strapiHandler:
      ((req: http.IncomingMessage, res: http.ServerResponse) => void) | null =
      null;
    const readyState = { ready: false, bootstrapFailed: false };

    const server = http.createServer((req, res) => {
      const handled = handleEarlyRequest(req, res, readyState, strapiHandler);
      if (!handled && strapiHandler) {
        strapiHandler(req, res);
      }
    });

    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve()),
    );
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;

    const t0 = Date.now();
    const wake = await fetch(`${base}/api/wake`, { cache: 'no-store' });
    assert.equal(wake.status, 200);
    const wakeMs = Date.now() - t0;
    assert.ok(wakeMs < 500, `wake should be fast, took ${wakeMs}ms`);

    const blocked = await fetch(`${base}/backoffice/`, { cache: 'no-store' });
    assert.equal(blocked.status, 503);

    setTimeout(() => {
      strapiHandler = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('ok');
      };
      readyState.ready = true;
    }, 800);

    let ready = false;
    for (let i = 0; i < 30 && !ready; i++) {
      const res = await fetch(`${base}/api/wake/ready`, { cache: 'no-store' });
      if (res.ok) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.equal(ready, true);

    const app = await fetch(`${base}/backoffice/`, { cache: 'no-store' });
    assert.equal(app.status, 200);

    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });
});
