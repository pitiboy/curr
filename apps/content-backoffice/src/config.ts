/** Strapi origin without path (see `.env.example`). */
export const STRAPI_URL =
  import.meta.env.VITE_STRAPI_URL ?? 'http://localhost:1337';

/** App bar label between the menu button and the page title. Empty hides it. */
export const APP_TITLE = import.meta.env.VITE_APP_TITLE ?? '';
