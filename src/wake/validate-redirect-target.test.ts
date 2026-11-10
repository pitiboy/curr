import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isSafeSameOriginRedirectPath,
  resolveRedirectTarget,
} from './validate-redirect-target';

describe('validate-redirect-target', () => {
  it('accepts same-origin relative paths', () => {
    assert.equal(isSafeSameOriginRedirectPath('/backoffice/'), true);
    assert.equal(isSafeSameOriginRedirectPath('/static/about'), true);
    assert.equal(resolveRedirectTarget('/backoffice/'), '/backoffice/');
  });

  it('rejects other origins and open redirects', () => {
    assert.equal(isSafeSameOriginRedirectPath('//evil.example/'), false);
    assert.equal(isSafeSameOriginRedirectPath('https://evil.example/'), false);
    assert.equal(isSafeSameOriginRedirectPath('/\\evil'), false);
    assert.equal(resolveRedirectTarget('https://evil.example/'), null);
    assert.equal(resolveRedirectTarget('//evil.example/'), null);
  });

  it('falls back when query param missing', () => {
    assert.equal(resolveRedirectTarget(null), '/backoffice/');
    assert.equal(resolveRedirectTarget(''), '/backoffice/');
  });
});
