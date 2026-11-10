import { describe, expect, it } from 'vitest';

import { resolveStrapiUrl, strapiAdminUrl } from './strapiUrl';

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

  it('prefers envUrl over window origin (e2e preview)', () => {
    expect(
      resolveStrapiUrl({
        dev: false,
        windowOrigin: 'http://127.0.0.1:4173',
        envUrl: 'http://127.0.0.1:1337',
      }),
    ).toBe('http://127.0.0.1:1337');
  });

  it('strips trailing slash from envUrl', () => {
    expect(
      resolveStrapiUrl({
        dev: false,
        envUrl: 'http://127.0.0.1:1337/',
      }),
    ).toBe('http://127.0.0.1:1337');
  });
});

describe('strapiAdminUrl', () => {
  it('appends /admin to the Strapi origin', () => {
    expect(strapiAdminUrl('http://localhost:1337')).toBe(
      'http://localhost:1337/admin',
    );
    expect(strapiAdminUrl('https://kor.fejlesztesek.hu/')).toBe(
      'https://kor.fejlesztesek.hu/admin',
    );
  });
});
