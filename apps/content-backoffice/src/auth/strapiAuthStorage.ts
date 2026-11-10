/** Matches ra-strapi strapiAuthProvider localStorage keys. */
export const STRAPI_USER_KEY = 'strapi_user';
export const STRAPI_JWT_KEY = 'strapi_jwt';

/** Same-tab signal: login/logout updated the Content JWT (storage events skip same tab). */
export const STRAPI_AUTH_CHANGED_EVENT = 'strapi-auth-changed';

export function notifyStrapiAuthChanged(): void {
  window.dispatchEvent(new Event(STRAPI_AUTH_CHANGED_EVENT));
}

export function persistStrapiAuthSession(jwt: string, user: unknown): void {
  localStorage.setItem(STRAPI_USER_KEY, JSON.stringify(user));
  localStorage.setItem(STRAPI_JWT_KEY, jwt);
  notifyStrapiAuthChanged();
}
