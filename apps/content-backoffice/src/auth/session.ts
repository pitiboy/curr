/**
 * Storage keys from ra-strapi 1.0.3 `strapiAuthProvider`. The package index
 * does not re-export them. checkAuth requires both items.
 */
export const STRAPI_JWT_KEY = 'strapi_jwt';
export const STRAPI_USER_KEY = 'strapi_user';

export type StrapiSessionUser = {
  id?: number | string;
  username?: string;
  email?: string;
  provider?: string;
};

export function storeStrapiSession(
  jwt: string,
  user: StrapiSessionUser,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(STRAPI_USER_KEY, JSON.stringify(user));
  storage.setItem(STRAPI_JWT_KEY, jwt);
}

export function isLocalProvider(provider: unknown): boolean {
  return provider === 'local';
}
