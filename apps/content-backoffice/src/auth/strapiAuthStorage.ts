/** Matches ra-strapi strapiAuthProvider localStorage keys. */
export const STRAPI_USER_KEY = 'strapi_user';
export const STRAPI_JWT_KEY = 'strapi_jwt';

export function persistStrapiAuthSession(jwt: string, user: unknown): void {
  localStorage.setItem(STRAPI_USER_KEY, JSON.stringify(user));
  localStorage.setItem(STRAPI_JWT_KEY, jwt);
}
