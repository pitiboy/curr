/**
 * Session storage key the static wake page reads when `?next=` is missing
 * (e.g. cPanel Error Pages redirect to site root `/`). The backoffice SPA
 * sets it in `apps/content-backoffice/index.html`.
 */
export const WAKE_RETURN_PATH_STORAGE_KEY = 'kor-wake-next';

/** Lightweight wake API path (no auth, no DB). */
export const WAKE_PATH = '/api/wake';

/** Returns 200 when Strapi finished bootstrap; 503 while still loading. */
export const WAKE_READY_PATH = '/api/wake/ready';

export const WAKE_CACHE_CONTROL = 'no-store, no-cache, must-revalidate';

export const WAKE_JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': WAKE_CACHE_CONTROL,
} as const;
