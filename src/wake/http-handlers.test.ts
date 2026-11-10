import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EventEmitter } from 'node:events';

import {
  handleEarlyRequest,
  isWakePath,
  requestPathname,
  respondWake,
} from './http-handlers';

function mockRes() {
  const res = new EventEmitter() as {
    writeHead: (status: number, headers?: Record<string, string>) => void;
    end: (body?: string) => void;
    statusCode?: number;
    headers?: Record<string, string>;
    body?: string;
    writableEnded: boolean;
  };
  res.writableEnded = false;
  res.writeHead = (status, headers) => {
    res.statusCode = status;
    res.headers = headers;
  };
  res.end = (body) => {
    res.body = body;
    res.writableEnded = true;
  };
  return res;
}

describe('wake http-handlers', () => {
  it('parses pathname from request URL', () => {
    assert.equal(requestPathname('/api/wake?x=1'), '/api/wake');
  });

  it('detects wake routes', () => {
    assert.equal(isWakePath('GET', '/api/wake'), 'wake');
    assert.equal(isWakePath('GET', '/api/wake/ready'), 'ready');
    assert.equal(isWakePath('POST', '/api/wake'), false);
  });

  it('responds to wake without Strapi', () => {
    const res = mockRes();
    const req = {
      method: 'GET',
      url: '/api/wake',
    } as import('node:http').IncomingMessage;
    const handled = handleEarlyRequest(
      req,
      res as never,
      { ready: false },
      null,
    );
    assert.equal(handled, true);
    assert.equal(res.statusCode, 200);
    assert.match(res.body ?? '', /"ok":true/);
    assert.equal(
      res.headers?.['Cache-Control'],
      'no-store, no-cache, must-revalidate',
    );
  });

  it('returns 503 for app routes while bootstrapping', () => {
    const res = mockRes();
    const req = {
      method: 'GET',
      url: '/backoffice/',
    } as import('node:http').IncomingMessage;
    const handled = handleEarlyRequest(
      req,
      res as never,
      { ready: false },
      null,
    );
    assert.equal(handled, true);
    assert.equal(res.statusCode, 503);
  });

  it('wake JSON is stable', () => {
    const res = mockRes();
    respondWake(res as never);
    assert.deepEqual(JSON.parse(res.body ?? '{}'), { ok: true, waking: true });
  });
});
