import type { IncomingMessage } from 'node:http';

import { resolveRedirectTarget } from './validate-redirect-target';

const WAKE_PREFIX = '/wake';

export function isWakeDocumentPath(pathname: string): boolean {
  return (
    pathname === WAKE_PREFIX ||
    pathname === `${WAKE_PREFIX}/` ||
    pathname === `${WAKE_PREFIX}/index.html`
  );
}

export function isBackofficeBrowserPath(pathname: string): boolean {
  return (
    pathname === '/backoffice' ||
    pathname === '/backoffice/' ||
    pathname.startsWith('/backoffice/')
  );
}

/** Full-page navigation (refresh, address bar) — not XHR/fetch API calls. */
export function prefersHtmlDocument(req: IncomingMessage): boolean {
  if (req.method !== 'GET') {
    return false;
  }
  const accept = req.headers.accept ?? '';
  if (!accept) {
    return true;
  }
  if (accept.includes('text/html')) {
    return true;
  }
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return false;
  }
  return accept.includes('*/*');
}

export function requestPathAndSearch(url: string | undefined): {
  pathname: string;
  search: string;
} {
  try {
    const parsed = new URL(url ?? '/', 'http://localhost');
    return { pathname: parsed.pathname, search: parsed.search };
  } catch {
    return { pathname: '/', search: '' };
  }
}

export function buildWakePageUrl(pathname: string, search: string): string {
  const target = resolveRedirectTarget(`${pathname}${search}`, '/backoffice/');
  const next = target ?? '/backoffice/';
  return `/wake/?next=${encodeURIComponent(next)}`;
}
