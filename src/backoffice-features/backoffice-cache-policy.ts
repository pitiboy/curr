const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable' as const;
const NO_STORE_CACHE = 'no-cache' as const;

/** Vite default: `name-[hash].ext` with an 8+ char hash segment. */
const VITE_HASHED_ASSET = /^.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i;

function isBackofficePath(pathname: string): boolean {
  return (
    pathname === '/backoffice' ||
    pathname === '/backoffice/' ||
    pathname.startsWith('/backoffice/')
  );
}

function isHashedBackofficeAsset(pathname: string): boolean {
  if (!pathname.startsWith('/backoffice/assets/')) {
    return false;
  }
  const basename = pathname.slice('/backoffice/assets/'.length);
  if (!basename || basename.includes('/')) {
    return false;
  }
  return VITE_HASHED_ASSET.test(basename);
}

/**
 * Returns Cache-Control for static backoffice paths, or null when this policy
 * does not apply (non-backoffice requests).
 */
export function backofficeCacheControlForPath(pathname: string): string | null {
  if (!isBackofficePath(pathname)) {
    return null;
  }

  if (pathname === '/backoffice/version.json') {
    return NO_STORE_CACHE;
  }

  if (isHashedBackofficeAsset(pathname)) {
    return IMMUTABLE_CACHE;
  }

  if (pathname.startsWith('/backoffice/assets/')) {
    return NO_STORE_CACHE;
  }

  if (
    pathname === '/backoffice' ||
    pathname === '/backoffice/' ||
    pathname === '/backoffice/index.html' ||
    pathname.endsWith('.html')
  ) {
    return NO_STORE_CACHE;
  }

  const underBackoffice = pathname.startsWith('/backoffice/');
  if (underBackoffice) {
    const rest = pathname.slice('/backoffice/'.length);
    if (rest && !rest.includes('/')) {
      return NO_STORE_CACHE;
    }
  }

  if (underBackoffice) {
    return NO_STORE_CACHE;
  }

  return null;
}
