import { describe, expect, it } from 'vitest';

import { resolveStrapiUrl } from './strapiUrl';

describe('resolveStrapiUrl', () => {
  it('uses VITE_STRAPI_URL in dev', () => {
    expect(
      resolveStrapiUrl({
        dev: true,
        viteStrapiUrl: 'http://localhost:1337',
        windowOrigin: 'http://localhost:5173',
      }),
    ).toBe('http://localhost:1337');
  });

  it('uses page origin in production', () => {
    expect(
      resolveStrapiUrl({
        dev: false,
        viteStrapiUrl: 'https://kor.fejlesztesek.hu',
        windowOrigin: 'https://edizone.fejlesztesek.hu',
      }),
    ).toBe('https://edizone.fejlesztesek.hu');
  });
});
