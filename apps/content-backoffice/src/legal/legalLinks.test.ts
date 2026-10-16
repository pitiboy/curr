import { describe, expect, it } from 'vitest';

import { LEGAL_PAGES, legalLocaleFor, legalPageUrl } from './legalLinks';

describe('legalPageUrl', () => {
  it('builds the hu URL without a locale query and without a double slash', () => {
    expect(legalPageUrl('privacy-policy', 'hu', 'https://kor.fejlesztesek.hu')).toBe(
      'https://kor.fejlesztesek.hu/legal/privacy-policy',
    );
    expect(legalPageUrl('terms-of-service', undefined, 'http://localhost:1337/')).toBe(
      'http://localhost:1337/legal/terms-of-service',
    );
  });

  it('adds ?locale=en when the UI is English', () => {
    expect(legalPageUrl('privacy-policy', 'en', 'https://kor.fejlesztesek.hu')).toBe(
      'https://kor.fejlesztesek.hu/legal/privacy-policy?locale=en',
    );
  });

  it('maps UI locales to page locales', () => {
    expect(legalLocaleFor('hu')).toBe('hu');
    expect(legalLocaleFor('hu-HU')).toBe('hu');
    expect(legalLocaleFor('en')).toBe('en');
    expect(legalLocaleFor(undefined)).toBe('hu');
  });

  it('links the two pages the Google consent screen needs', () => {
    expect(LEGAL_PAGES.map((page) => page.slug)).toEqual([
      'privacy-policy',
      'terms-of-service',
    ]);
  });
});
