/** Strapi origin without path (see `.env.example`). */
export const STRAPI_URL =
  import.meta.env.VITE_STRAPI_URL ?? 'http://localhost:1337';

/** Prefix of the app bar title (`VITE_APP_TITLE » app.title`). Empty omits the prefix. */
export const APP_TITLE = import.meta.env.VITE_APP_TITLE ?? '';
