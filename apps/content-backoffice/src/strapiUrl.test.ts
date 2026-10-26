import { describe, expect, it } from 'vitest';

import { resolveStrapiUrl } from './strapiUrl';

describe('resolveStrapiUrl', () => {
  it('uses local Strapi in dev', () => {
    expect(
      resolveStrapiUrl({
        dev: true,
        windowOrigin: 'http://localhost:5173',
      }),
    ).toBe('http://localhost:1337');
  });

  it('uses page origin in production', () => {
    expect(
      resolveStrapiUrl({
        dev: false,
        windowOrigin: 'https://edizone.fejlesztesek.hu',
      }),
    ).toBe('https://edizone.fejlesztesek.hu');
  });
});
