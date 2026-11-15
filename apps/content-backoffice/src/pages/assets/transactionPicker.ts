import type { ContentHttpClient } from '../../data/receiptDraft';
import {
  convertedToWorkflowFilterClauses,
  DEFAULT_CONVERTED_FILTER,
  type StrapiTransaction,
} from '../../data/transactionList';
import { loadReportTransactions } from '../reports/shared/reportTransactionStatus';
import { FIXED_ASSET_ACCOUNT_CODE } from './assetConstants';

/** Rows shown per picker search (both publication states). */
export const TRANSACTION_PICKER_PAGE_SIZE = 20;

/** Which 1500 side the empty search suggests (acquisition = debit). */
export type TransactionPickerSide = 'debit' | 'credit';

export type TransactionPickerOption = {
  id: string;
  label: string;
};

/**
 * Strapi filters for the asset form's transaction picker. Empty search lists
 * the latest rows on the 1500 side; text searches description / documentId,
 * a number also matches the amount.
 */
export function transactionPickerFilters(
  search: string,
  side: TransactionPickerSide,
): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];
  const converted = convertedToWorkflowFilterClauses([
    ...DEFAULT_CONVERTED_FILTER,
  ]);
  if (converted.length === 1) and.push(converted[0]!);
  else if (converted.length > 1) and.push({ $or: converted });

  const query = search.trim();
  if (!query) {
    const field = side === 'debit' ? 'debit_account' : 'credit_account';
    and.push({ [field]: { code: { $eq: FIXED_ASSET_ACCOUNT_CODE } } });
  } else {
    const or: Record<string, unknown>[] = [
      { description: { $containsi: query } },
      { documentId: { $eq: query } },
    ];
    const amount = Number(query.replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(amount)) or.push({ amount: { $eq: amount } });
    and.push({ $or: or });
  }
  return { $and: and };
}

export function transactionOptionLabel(
  row: Pick<
    StrapiTransaction,
    'date' | 'amount' | 'description' | 'currency_type' | 'documentId'
  >,
): string {
  const amount =
    row.amount == null || row.amount === ''
      ? ''
      : `${row.amount} ${row.currency_type?.code ?? ''}`.trim();
  return [row.date, amount, row.description?.trim() || row.documentId]
    .filter((part) => part != null && String(part).trim() !== '')
    .join(' · ');
}

export async function searchTransactionsForPicker(
  httpClient: ContentHttpClient,
  search: string,
  side: TransactionPickerSide,
): Promise<TransactionPickerOption[]> {
  const rows = await loadReportTransactions<StrapiTransaction>(
    httpClient,
    'all',
    {
      filters: transactionPickerFilters(search, side),
      fields: ['documentId', 'date', 'amount', 'description'],
      populate: { currency_type: { fields: ['code'] } },
      sort: ['date:desc', 'id:desc'],
    },
    { maxPages: 1 },
  );
  return rows
    .filter((row) => row.documentId)
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
    .slice(0, TRANSACTION_PICKER_PAGE_SIZE)
    .map((row) => ({
      id: row.documentId as string,
      label: transactionOptionLabel(row),
    }));
}
