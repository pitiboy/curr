import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isBackofficeBrowserPath,
  prefersHtmlDocument,
  WAKE_BOOTSTRAP_REDIRECT,
} from './bootstrap-browser';

describe('bootstrap-browser', () => {
  it('redirect target is site root (statikus wake index)', () => {
    assert.equal(WAKE_BOOTSTRAP_REDIRECT, '/');
  });

  it('detects backoffice document paths', () => {
    assert.equal(isBackofficeBrowserPath('/backoffice'), true);
    assert.equal(isBackofficeBrowserPath('/backoffice/transactions'), true);
    assert.equal(isBackofficeBrowserPath('/api/backoffice/config'), false);
  });

  it('prefersHtmlDocument for browser navigations', () => {
    assert.equal(
      prefersHtmlDocument({
        method: 'GET',
        headers: { accept: 'text/html' },
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
  });
});
