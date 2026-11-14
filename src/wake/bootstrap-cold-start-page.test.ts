import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildColdStartInterstitialHtml,
  WAKE_COLD_START_REDIRECT_DELAY_MS,
} from './bootstrap-cold-start-page';

describe('bootstrap-cold-start-page', () => {
  it('includes Hungarian copy and redirect', () => {
    const html = buildColdStartInterstitialHtml('/');
    assert.match(html, /hidegen indul/);
    assert.match(html, /Átirányítás következik/);
    assert.match(html, /location\.replace\("\/"\)/);
    assert.ok(html.includes(String(WAKE_COLD_START_REDIRECT_DELAY_MS)));
  });

  it('rejects protocol-relative redirect targets', () => {
    const html = buildColdStartInterstitialHtml('//evil.example');
    assert.match(html, /location\.replace\("\/"\)/);
  });
});
