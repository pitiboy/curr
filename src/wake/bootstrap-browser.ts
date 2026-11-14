import type { IncomingMessage } from 'node:http';

/** Statikus wake landing (public_html); bootstrap alatt ide irányítunk böngészőt. */
export const WAKE_BOOTSTRAP_REDIRECT = '/';

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
