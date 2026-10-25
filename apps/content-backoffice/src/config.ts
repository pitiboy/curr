import { resolveStrapiUrl } from './strapiUrl';

/** Strapi origin without path (see `.env.example`). */
export const STRAPI_URL = resolveStrapiUrl({
  dev: import.meta.env.DEV,
  viteStrapiUrl: import.meta.env.VITE_STRAPI_URL,
  windowOrigin:
    typeof window !== 'undefined' ? window.location.origin : undefined,
});

/** Prefix of the app bar title (`VITE_APP_TITLE » app.title`). Empty omits the prefix. */
export const APP_TITLE = import.meta.env.VITE_APP_TITLE ?? '';
