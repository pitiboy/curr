import { STRAPI_URL } from '../config';

/**
 * Public legal pages rendered by Strapi from the `legal-page` content type
 * (see `src/legal-pages.ts` in the Strapi root). No login needed, and the
 * content is always the current DB version.
 */
export const LEGAL_PAGES = [
  { slug: 'privacy-policy', labelKey: 'app.legal_privacy' },
  { slug: 'terms-of-service', labelKey: 'app.legal_terms' },
] as const;

/** Page language for a UI locale: hu stays the default, anything else is en. */
export function legalLocaleFor(uiLocale: string | undefined) {
  return (uiLocale ?? 'hu').toLowerCase().startsWith('hu') ? 'hu' : 'en';
}

/**
 * `https://kor.fejlesztesek.hu/legal/privacy-policy` (hu, the stable Google
 * URL) or `…/legal/privacy-policy?locale=en`.
 */
export function legalPageUrl(
  slug: string,
  uiLocale?: string,
  strapiUrl: string = STRAPI_URL,
) {
  const base = `${strapiUrl.replace(/\/+$/, '')}/legal/${slug}`;
  return legalLocaleFor(uiLocale) === 'en' ? `${base}?locale=en` : base;
}
