import {
  CONVERTED_TO_WORKFLOW_CHOICES,
  DEFAULT_CONVERTED_FILTER,
  type ConvertedFilterValue,
} from './transactionList';

export type TransactionListMode = 'all' | 'draft';

/** Review menu: every deal-expansion value selected. */
export const REVIEW_CONVERTED_FILTER: ConvertedFilterValue[] = [
  ...CONVERTED_TO_WORKFLOW_CHOICES,
];

export function defaultTransactionListFilter(
  mode: TransactionListMode = 'all',
): Record<string, unknown> {
  if (mode === 'draft') {
    return {
      status: 'draft',
      converted_to_workflow: [...REVIEW_CONVERTED_FILTER],
    };
  }
  return {
    converted_to_workflow: [...DEFAULT_CONVERTED_FILTER],
  };
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
 * Transactions defaults to hiding `original` and `storno`; Review selects all.
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
