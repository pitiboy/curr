export const TRANSACTIONS_LIST_PATH = '/transactions' as const;

export function filterFromListSearch(search: string): Record<string, unknown> {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  );
  const raw = params.get('filter');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Which transaction menu item is active. The list filters live in the global
 * Jotai atom, so the mode comes from its status; other paths match neither.
 */
export function transactionListMode(
  pathname: string,
  globalStatus: 'preview' | 'draft' | 'all',
): 'all' | 'draft' | null {
  if (pathname !== TRANSACTIONS_LIST_PATH) return null;
  return globalStatus === 'draft' ? 'draft' : 'all';
}
