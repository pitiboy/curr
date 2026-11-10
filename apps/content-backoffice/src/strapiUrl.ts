/** Strapi origin without path. Dev: local Strapi; prod: same origin as the SPA. */
export function resolveStrapiUrl(options: {
  dev: boolean;
  windowOrigin?: string;
  /** `VITE_STRAPI_URL` override (e2e preview: SPA on :4173, API on :1337). */
  envUrl?: string;
}): string {
  const fromEnv = options.envUrl?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (options.dev) {
    return 'http://localhost:1337';
  }
  const fromWindow = options.windowOrigin?.trim();
  return fromWindow || 'http://localhost:1337';
}

/** Strapi admin UI (`/admin` on the Strapi origin). */
export function strapiAdminUrl(strapiOrigin: string): string {
  return `${strapiOrigin.replace(/\/+$/, '')}/admin`;
}
