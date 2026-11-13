import {
  DEFAULT_CONVERTED_FILTER,
  RECEIPT_PRESENCE_FILTER_KEY,
} from '../../../data/transactionList';

export type TransactionListLink = {
  pathname: '/transactions';
  search: string;
};

export function buildDraftTransactionsDrilldown(): TransactionListLink {
  const filter: Record<string, unknown> = {
    status: 'draft',
    converted_to_workflow: [...DEFAULT_CONVERTED_FILTER],
  };
  const params = new URLSearchParams();
  params.set('filter', JSON.stringify(filter));
  params.set(
    'displayedFilters',
    JSON.stringify({
      status: true,
      converted_to_workflow: true,
    }),
  );
  return { pathname: '/transactions', search: `?${params.toString()}` };
}

export function buildPublishedWithoutReceiptsDrilldown(): TransactionListLink {
  const filter: Record<string, unknown> = {
    status: 'published',
    converted_to_workflow: [...DEFAULT_CONVERTED_FILTER],
    [RECEIPT_PRESENCE_FILTER_KEY]: 'none',
  };
  const params = new URLSearchParams();
  params.set('filter', JSON.stringify(filter));
  params.set(
    'displayedFilters',
    JSON.stringify({
      status: true,
      converted_to_workflow: true,
    }),
  );
  return { pathname: '/transactions', search: `?${params.toString()}` };
}
