/** Vite preview started by Playwright's webServer (`preview:e2e` binds 127.0.0.1:4173). */
export const PREVIEW_BACKOFFICE_URL = 'http://127.0.0.1:4173/backoffice';

/** `localhost` may resolve to ::1 while Vite / Strapi listen on IPv4 only. */
function ipv4Loopback(url: string): string {
  return url.trim().replace(/\/+$/, '').replace('://localhost', '://127.0.0.1');
}

export function e2eStrapiUrl(): string {
  return ipv4Loopback(process.env.E2E_STRAPI_URL ?? 'http://127.0.0.1:1337');
}

export function backofficeBase(): string {
  return ipv4Loopback(process.env.E2E_BACKOFFICE_URL ?? PREVIEW_BACKOFFICE_URL);
}
