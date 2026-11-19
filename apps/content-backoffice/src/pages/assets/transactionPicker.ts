import type { ContentHttpClient } from '../../data/receiptDraft';
import {
  convertedToWorkflowFilterClauses,
  DEFAULT_CONVERTED_FILTER,
  type StrapiTransaction,
} from '../../data/transactionList';
import { loadReportTransactions } from '../reports/shared/reportTransactionStatus';
import { FIXED_ASSET_ACCOUNT_CODE, KOR_CURRENCY_CODE } from './assetConstants';
import {
  loadTransactionUsage,
  type TransactionUsage,
} from './transactionUsage';

/** Rows shown per picker search (both publication states). */
export const TRANSACTION_PICKER_PAGE_SIZE = 20;

/** Which 1500 side the empty search suggests (acquisition = debit). */
export type TransactionPickerSide = 'debit' | 'credit';

export type TransactionPickerOption = {
  id: string;
  label: string;
  amount?: number | null;
  currencyCode?: string | null;
  /** Assets already linked to it on this side (the edited asset excluded). */
  usage?: TransactionUsage;
};

function toAmount(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Strapi filters for the asset form's transaction picker. Always limited to
 * the 1500 side (debit for acquisition, credit for disposal); a text search
 * only narrows that by description / documentId, a number also by amount.
 * KOR-denominated rows are never offered.
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
  and.push({ currency_type: { code: { $ne: KOR_CURRENCY_CODE } } });

  const field = side === 'debit' ? 'debit_account' : 'credit_account';
  and.push({ [field]: { code: { $eq: FIXED_ASSET_ACCOUNT_CODE } } });

  const query = search.trim();
  if (query) {
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

type PickerRow = Pick<
  StrapiTransaction,
  'documentId' | 'date' | 'amount' | 'description' | 'currency_type'
> & { related_transaction?: { documentId?: string | null } | null };

/** The deal a row belongs to: its original, or itself when not expanded. */
export function transactionDealId(row: PickerRow): string | null {
  return row.related_transaction?.documentId ?? row.documentId ?? null;
}

/**
 * Disposal side: drops rows of deals that also debit 1500 (an acquisition's
 * own internal transfers, e.g. the "HUF fedezet" leg) — they are not disposals.
 */
export function excludeAcquisitionDeals<T extends PickerRow>(
  rows: readonly T[],
  acquisitionDealIds: ReadonlySet<string>,
): T[] {
  return rows.filter((row) => {
    const deal = transactionDealId(row);
    return !deal || !acquisitionDealIds.has(deal);
  });
}

/** Deal ids (of the given ones) that contain a 1500 debit row. */
async function loadAcquisitionDealIds(
  httpClient: ContentHttpClient,
  dealIds: readonly string[],
): Promise<Set<string>> {
  if (dealIds.length === 0) return new Set();
  const ids = [...dealIds];
  const rows = await loadReportTransactions<PickerRow>(
    httpClient,
    'all',
    {
      filters: {
        $and: [
          {
            $or: [
              { related_transaction: { documentId: { $in: ids } } },
              { documentId: { $in: ids } },
            ],
          },
          { debit_account: { code: { $eq: FIXED_ASSET_ACCOUNT_CODE } } },
        ],
      },
      fields: ['documentId'],
      populate: { related_transaction: { fields: ['documentId'] } },
    },
    { maxPages: 1 },
  );
  const found = new Set<string>();
  for (const row of rows) {
    const deal = transactionDealId(row);
    if (deal) found.add(deal);
  }
  return found;
}

export async function searchTransactionsForPicker(
  httpClient: ContentHttpClient,
  search: string,
  side: TransactionPickerSide,
  excludeAssetId?: string | null,
): Promise<TransactionPickerOption[]> {
  let rows = await loadReportTransactions<PickerRow>(
    httpClient,
    'all',
    {
      filters: transactionPickerFilters(search, side),
      fields: ['documentId', 'date', 'amount', 'description'],
      populate: {
        currency_type: { fields: ['code'] },
        related_transaction: { fields: ['documentId'] },
      },
      sort: ['date:desc', 'id:desc'],
    },
    { maxPages: 1 },
  );
  if (side === 'credit') {
    const dealIds = new Set<string>();
    for (const row of rows) {
      const deal = transactionDealId(row);
      if (deal) dealIds.add(deal);
    }
    const acquisitionDeals = await loadAcquisitionDealIds(httpClient, [
      ...dealIds,
    ]);
    rows = excludeAcquisitionDeals(rows, acquisitionDeals);
  }
  const shown = rows
    .filter((row) => row.documentId)
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
    .slice(0, TRANSACTION_PICKER_PAGE_SIZE);
  const usage = await loadTransactionUsage(
    httpClient,
    shown.map((row) => row.documentId as string),
    side,
    excludeAssetId,
  );
  return shown.map((row) => {
    const id = row.documentId as string;
    return {
      id,
      label: transactionOptionLabel(row),
      amount: toAmount(row.amount),
      currencyCode: row.currency_type?.code ?? null,
      usage: usage.get(id),
    };
  });
}
