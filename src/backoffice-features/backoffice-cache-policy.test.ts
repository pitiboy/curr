import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { backofficeCacheControlForPath } from './backoffice-cache-policy';

describe('backofficeCacheControlForPath', () => {
  it('ignores non-backoffice paths', () => {
    assert.equal(backofficeCacheControlForPath('/api/transactions'), null);
    assert.equal(backofficeCacheControlForPath('/admin'), null);
  });

  it('sets no-cache on shell, version.json, and non-hashed assets', () => {
    assert.equal(backofficeCacheControlForPath('/backoffice/'), 'no-cache');
    assert.equal(backofficeCacheControlForPath('/backoffice'), 'no-cache');
    assert.equal(
      backofficeCacheControlForPath('/backoffice/index.html'),
      'no-cache',
    );
    assert.equal(
      backofficeCacheControlForPath('/backoffice/version.json'),
      'no-cache',
    );
    assert.equal(
      backofficeCacheControlForPath('/backoffice/assets/manual-patch.js'),
      'no-cache',
    );
  });

  it('sets long-lived cache on hashed Vite assets', () => {
    assert.equal(
      backofficeCacheControlForPath('/backoffice/assets/index-a1b2c3d4.js'),
      'public, max-age=31536000, immutable',
    );
    assert.equal(
      backofficeCacheControlForPath('/backoffice/assets/App-DeadBeef12.css'),
      'public, max-age=31536000, immutable',
    );
  });
});
