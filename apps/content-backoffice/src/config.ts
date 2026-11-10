import { resolveStrapiUrl } from './strapiUrl';

/** Strapi origin without path. `VITE_STRAPI_URL` → that; dev → localhost:1337; prod → page origin. */
export const STRAPI_URL = resolveStrapiUrl({
  dev: import.meta.env.DEV,
  windowOrigin:
    typeof window !== 'undefined' ? window.location.origin : undefined,
  envUrl: import.meta.env.VITE_STRAPI_URL,
});
