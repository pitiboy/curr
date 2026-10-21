import { STRAPI_URL } from '../config';

/**
 * Public static pages rendered by Strapi from the `static-page` content type
 * (see `src/static-pages.ts` in the Strapi root). No login needed, and the
 * URL always reflects the current DB content.
 */
export const STATIC_PAGES = [
  { slug: 'privacy-policy', labelKey: 'app.static_privacy' },
  { slug: 'terms-of-service', labelKey: 'app.static_terms' },
] as const;

/** Maps the backoffice UI locale to the static page locale (hu or en). */
export function staticLocaleFor(uiLocale: string | undefined) {
  const code = (uiLocale ?? 'hu').trim().toLowerCase().slice(0, 2);
  return code === 'en' ? 'en' : 'hu';
}

/**
 * `https://kor.fejlesztesek.hu/static/privacy-policy` (hu, the stable Google
 * URL) or `…/static/privacy-policy?locale=en`.
 */
export function staticPageUrl(
  slug: string,
  uiLocale: string | undefined,
  baseUrl: string = STRAPI_URL,
) {
  const base = `${baseUrl.replace(/\/+$/, '')}/static/${slug}`;
  return staticLocaleFor(uiLocale) === 'en' ? `${base}?locale=en` : base;
}
