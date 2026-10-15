import { describe, expect, it } from 'vitest';

import {
  isLocalProvider,
  storeStrapiSession,
  STRAPI_JWT_KEY,
  STRAPI_USER_KEY,
} from './session';

describe('storeStrapiSession', () => {
  it('writes the jwt and user on the ra-strapi 1.0.3 keys', () => {
    const storage = new Map<string, string>();
    storeStrapiSession(
      'jwt-from-google',
      { id: 7, username: 'anna' },
      {
        setItem: (key, value) => {
          storage.set(key, value);
        },
      },
    );

    expect(STRAPI_JWT_KEY).toBe('strapi_jwt');
    expect(STRAPI_USER_KEY).toBe('strapi_user');
    expect(storage.get(STRAPI_JWT_KEY)).toBe('jwt-from-google');
    expect(JSON.parse(storage.get(STRAPI_USER_KEY) ?? '')).toEqual({
      id: 7,
      username: 'anna',
    });
  });
});

describe('isLocalProvider', () => {
  it('is true only for local', () => {
    expect(isLocalProvider('local')).toBe(true);
    expect(isLocalProvider('google')).toBe(false);
    expect(isLocalProvider(null)).toBe(false);
    expect(isLocalProvider(undefined)).toBe(false);
  });
});
