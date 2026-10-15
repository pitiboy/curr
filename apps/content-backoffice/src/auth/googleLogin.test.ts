import { describe, expect, it, vi } from 'vitest';

import {
  accessTokenFromLocation,
  completeGoogleLoginFromWindow,
  exchangeGoogleAccessToken,
  googleCallbackUrl,
  googleConnectUrl,
  stripAccessTokenHref,
} from './googleLogin';
import { STRAPI_JWT_KEY, STRAPI_USER_KEY } from './session';

describe('googleConnectUrl', () => {
  it('starts the Strapi connect flow', () => {
    expect(googleConnectUrl('http://localhost:1337')).toBe(
      'http://localhost:1337/api/connect/google',
    );
    expect(googleConnectUrl('http://localhost:1337/')).toBe(
      'http://localhost:1337/api/connect/google',
    );
  });
});

describe('accessTokenFromLocation', () => {
  it('reads the query on the path and on the hash', () => {
    expect(accessTokenFromLocation('?access_token=from-search')).toBe(
      'from-search',
    );
    expect(
      accessTokenFromLocation('', '#/login?access_token=from-hash'),
    ).toBe('from-hash');
    expect(accessTokenFromLocation('')).toBeNull();
  });
});

describe('stripAccessTokenHref', () => {
  it('drops the token from search and hash', () => {
    expect(
      stripAccessTokenHref(
        'http://localhost:5173/backoffice/?access_token=abc#/login',
      ),
    ).toBe('http://localhost:5173/backoffice/#/login');
    expect(
      stripAccessTokenHref(
        'http://localhost:5173/backoffice/#/login?access_token=abc',
      ),
    ).toBe('http://localhost:5173/backoffice/#/login');
  });
});

describe('exchangeGoogleAccessToken', () => {
  it('calls the Strapi google callback and returns jwt plus user', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        jwt: 'content-jwt',
        user: { id: 3, username: 'google-user', provider: 'google' },
      }),
    }));

    await expect(
      exchangeGoogleAccessToken(
        'http://localhost:1337',
        'google-access',
        fetchImpl as unknown as typeof fetch,
      ),
    ).resolves.toEqual({
      jwt: 'content-jwt',
      user: { id: 3, username: 'google-user', provider: 'google' },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      googleCallbackUrl('http://localhost:1337', 'google-access'),
    );
  });
});

describe('completeGoogleLoginFromWindow', () => {
  it('stores the jwt on the ra-strapi keys and strips the token', async () => {
    const storage = new Map<string, string>();
    const history = { replaceState: vi.fn() };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        jwt: 'content-jwt',
        user: { id: 3, username: 'google-user' },
      }),
    }));

    await expect(
      completeGoogleLoginFromWindow(
        {
          href: 'http://localhost:5173/backoffice/?access_token=google-access#/',
          search: '?access_token=google-access',
          hash: '#/',
        },
        history,
        {
          baseURL: 'http://localhost:1337',
          fetchImpl: fetchImpl as unknown as typeof fetch,
          storage: {
            setItem: (key, value) => {
              storage.set(key, value);
            },
          },
        },
      ),
    ).resolves.toBe(true);

    expect(storage.get(STRAPI_JWT_KEY)).toBe('content-jwt');
    expect(JSON.parse(storage.get(STRAPI_USER_KEY) ?? '')).toEqual({
      id: 3,
      username: 'google-user',
    });
    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      'http://localhost:5173/backoffice/#/',
    );
  });
});
