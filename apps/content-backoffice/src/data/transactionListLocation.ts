export type TransactionListMode = 'all' | 'draft';

/**
 * Menu targets for the shared transaction list.
 * The search always sets `filter`, so a stored draft filter cannot survive
 * the unfiltered menu item, and a stored clear cannot survive Review.
 */
export function transactionsMenuTo(mode: TransactionListMode): {
  pathname: '/transactions';
  search: string;
} {
  const filter = mode === 'draft' ? { status: 'draft' } : {};
  const displayedFilters = mode === 'draft' ? { status: true } : {};
  const params = new URLSearchParams();
  params.set('filter', JSON.stringify(filter));
  params.set('displayedFilters', JSON.stringify(displayedFilters));
  return {
    pathname: '/transactions',
    search: `?${params.toString()}`,
  };
}

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

/** Which menu item matches the list URL. Other paths match neither. */
export function transactionListMode(
  pathname: string,
  search: string,
): TransactionListMode | null {
  if (pathname !== '/transactions') return null;
  return filterFromListSearch(search).status === 'draft' ? 'draft' : 'all';
}
