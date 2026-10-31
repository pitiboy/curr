import {
  DEFAULT_CONVERTED_FILTER,
  type ConvertedFilterValue,
} from './transactionList';

export type TransactionListMode = 'all' | 'draft';

export function defaultTransactionListFilter(
  mode: TransactionListMode = 'all',
): Record<string, unknown> {
  const converted_to_workflow: ConvertedFilterValue[] = [
    ...DEFAULT_CONVERTED_FILTER,
  ];
  if (mode === 'draft') {
    return { status: 'draft', converted_to_workflow };
  }
  return { converted_to_workflow };
}

export function defaultTransactionDisplayedFilters(
  mode: TransactionListMode = 'all',
): Record<string, boolean> {
  const displayed: Record<string, boolean> = {
    converted_to_workflow: true,
  };
  if (mode === 'draft') displayed.status = true;
  return displayed;
}

/**
 * Menu targets for the shared transaction list.
 * The search always sets `filter`, so a stored draft filter cannot survive
 * the unfiltered menu item, and a stored clear cannot survive Review.
 * `converted_to_workflow` always defaults to hiding `original` and `storno`.
 */
export function transactionsMenuTo(mode: TransactionListMode): {
  pathname: '/transactions';
  search: string;
} {
  const filter = defaultTransactionListFilter(mode);
  const displayedFilters = defaultTransactionDisplayedFilters(mode);
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
