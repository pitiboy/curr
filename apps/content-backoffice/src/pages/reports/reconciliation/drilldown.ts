import {
  DEFAULT_CONVERTED_FILTER,
  RECEIPT_LIKELY_REQUIRED_FILTER_KEY,
  RECEIPT_PRESENCE_FILTER_KEY,
} from '../../../data/transactionList';
import {
  accountFilterIsActive,
  type PublishedWithoutReceiptsAccountFilter,
} from './publishedWithoutReceiptsFilter';

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

export function buildPublishedWithoutReceiptsDrilldown(
  accountFilter?: PublishedWithoutReceiptsAccountFilter,
): TransactionListLink {
  const filter: Record<string, unknown> = {
    status: 'published',
    converted_to_workflow: [...DEFAULT_CONVERTED_FILTER],
    [RECEIPT_PRESENCE_FILTER_KEY]: 'none',
  };
  if (accountFilter && accountFilterIsActive(accountFilter)) {
    filter[RECEIPT_LIKELY_REQUIRED_FILTER_KEY] = {
      creditCodes: [...accountFilter.creditCodes],
      debitCodes: [...accountFilter.debitCodes],
    };
  }
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
