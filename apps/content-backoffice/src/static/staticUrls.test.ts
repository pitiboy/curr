import { describe, expect, it } from 'vitest';

import { STATIC_PAGES, staticLocaleFor, staticPageUrl } from './staticUrls';

describe('staticPageUrl', () => {
  it('builds hu URLs without query', () => {
    expect(
      staticPageUrl('privacy-policy', 'hu', 'https://kor.fejlesztesek.hu'),
    ).toBe('https://kor.fejlesztesek.hu/static/privacy-policy');
    expect(
      staticPageUrl('terms-of-service', undefined, 'http://localhost:1337/'),
    ).toBe('http://localhost:1337/static/terms-of-service');
  });

  it('adds locale=en for English UI', () => {
    expect(
      staticPageUrl('privacy-policy', 'en', 'https://kor.fejlesztesek.hu'),
    ).toBe('https://kor.fejlesztesek.hu/static/privacy-policy?locale=en');
  });

  it('maps UI locale to static page locale', () => {
    expect(staticLocaleFor('hu')).toBe('hu');
    expect(staticLocaleFor('hu-HU')).toBe('hu');
    expect(staticLocaleFor('en')).toBe('en');
    expect(staticLocaleFor(undefined)).toBe('hu');
  });

  it('lists the OAuth-linked slugs', () => {
    expect(STATIC_PAGES.map((page) => page.slug)).toEqual([
      'privacy-policy',
      'terms-of-service',
    ]);
  });
});
