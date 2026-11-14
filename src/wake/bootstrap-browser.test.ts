import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildWakePageUrl,
  isBackofficeBrowserPath,
  isWakeDocumentPath,
  prefersHtmlDocument,
} from './bootstrap-browser';

describe('bootstrap-browser', () => {
  it('detects wake and backoffice document paths', () => {
    assert.equal(isWakeDocumentPath('/wake'), true);
    assert.equal(isWakeDocumentPath('/wake/'), true);
    assert.equal(isWakeDocumentPath('/wake/index.html'), true);
    assert.equal(isWakeDocumentPath('/wake/foo'), false);

    assert.equal(isBackofficeBrowserPath('/backoffice'), true);
    assert.equal(isBackofficeBrowserPath('/backoffice/'), true);
    assert.equal(isBackofficeBrowserPath('/backoffice/transactions'), true);
    assert.equal(isBackofficeBrowserPath('/api/backoffice/config'), false);
  });

  it('prefersHtmlDocument for browser navigations', () => {
    assert.equal(
      prefersHtmlDocument({
        method: 'GET',
        headers: { accept: 'text/html,application/xhtml+xml' },
      } as never),
      true,
    );
    assert.equal(
      prefersHtmlDocument({
        method: 'GET',
        headers: { accept: 'application/json' },
      } as never),
      false,
    );
    assert.equal(
      prefersHtmlDocument({ method: 'HEAD', headers: {} } as never),
      false,
    );
  });

  it('builds wake redirect with encoded next', () => {
    const url = buildWakePageUrl('/backoffice/transactions', '?foo=1');
    assert.match(url, /^\/wake\/\?next=/);
    assert.ok(
      url.includes(encodeURIComponent('/backoffice/transactions?foo=1')),
    );
  });
});
