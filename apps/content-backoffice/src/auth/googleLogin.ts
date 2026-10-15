import { STRAPI_URL } from '../config';
import { storeStrapiSession, type StrapiSessionUser } from './session';

const GOOGLE_LOGIN_ERROR_KEY = 'backoffice.googleLoginError';

export function googleConnectUrl(baseURL: string): string {
  return `${baseURL.replace(/\/$/, '')}/api/connect/google`;
}

export function googleCallbackUrl(
  baseURL: string,
  accessToken: string,
): string {
  const url = new URL(
    `${baseURL.replace(/\/$/, '')}/api/auth/google/callback`,
  );
  url.searchParams.set('access_token', accessToken);
  return url.toString();
}

export function accessTokenFromLocation(search: string, hash = ''): string | null {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const fromSearch = new URLSearchParams(query).get('access_token');
  if (fromSearch) return fromSearch;
  const hashQueryIndex = hash.indexOf('?');
  if (hashQueryIndex === -1) return null;
  return new URLSearchParams(hash.slice(hashQueryIndex + 1)).get(
    'access_token',
  );
}

export function stripAccessTokenHref(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('access_token');
  url.searchParams.delete('id_token');
  const hashQueryIndex = url.hash.indexOf('?');
  if (hashQueryIndex !== -1) {
    const path = url.hash.slice(0, hashQueryIndex);
    const params = new URLSearchParams(url.hash.slice(hashQueryIndex + 1));
    params.delete('access_token');
    params.delete('id_token');
    const remaining = params.toString();
    url.hash = remaining ? `${path}?${remaining}` : path;
  }
  return url.toString();
}

type GoogleAuthResponse = {
  jwt?: string;
  user?: StrapiSessionUser;
};

export async function exchangeGoogleAccessToken(
  baseURL: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ jwt: string; user: StrapiSessionUser }> {
  const response = await fetchImpl(googleCallbackUrl(baseURL, accessToken));
  const json = (await response.json()) as GoogleAuthResponse;
  if (!response.ok || typeof json.jwt !== 'string' || !json.user) {
    throw new Error('Google login failed');
  }
  return { jwt: json.jwt, user: json.user };
}

export async function completeGoogleLoginFromWindow(
  location: Pick<Location, 'href' | 'search' | 'hash'>,
  historyApi: Pick<History, 'replaceState'>,
  deps: {
    baseURL?: string;
    fetchImpl?: typeof fetch;
    storage?: Pick<Storage, 'setItem'>;
  } = {},
): Promise<boolean> {
  const accessToken = accessTokenFromLocation(location.search, location.hash);
  if (!accessToken) return false;

  try {
    const { jwt, user } = await exchangeGoogleAccessToken(
      deps.baseURL ?? STRAPI_URL,
      accessToken,
      deps.fetchImpl,
    );
    storeStrapiSession(jwt, user, deps.storage);
    return true;
  } finally {
    historyApi.replaceState(null, '', stripAccessTokenHref(location.href));
  }
}

export function rememberGoogleLoginError(): void {
  sessionStorage.setItem(GOOGLE_LOGIN_ERROR_KEY, '1');
}

export function consumeGoogleLoginError(): boolean {
  const found = sessionStorage.getItem(GOOGLE_LOGIN_ERROR_KEY) === '1';
  if (found) sessionStorage.removeItem(GOOGLE_LOGIN_ERROR_KEY);
  return found;
}
