/** Session key used by the static wake page (`docs/deploy/wake/index.html`). */
export const WAKE_RETURN_PATH_STORAGE_KEY = 'kor-wake-next';

const BACKOFFICE_PATH = /^\/backoffice(?:\/|$)/;

export function shouldPersistWakeReturnPath(path: string): boolean {
  return BACKOFFICE_PATH.test(path);
}

/** Remember where to return after a cold start or error-page redirect to `/`. */
export function persistWakeReturnPath(
  pathname: string,
  search = '',
  hash = '',
): void {
  const path = `${pathname}${search}${hash}`;
  if (!shouldPersistWakeReturnPath(path)) {
    return;
  }
  try {
    sessionStorage.setItem(WAKE_RETURN_PATH_STORAGE_KEY, path);
  } catch {
    // Private browsing or disabled storage.
  }
}
