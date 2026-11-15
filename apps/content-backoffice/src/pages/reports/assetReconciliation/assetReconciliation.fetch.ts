import type { ContentHttpClient } from '../../../data/receiptDraft';
import {
  convertedToWorkflowFilterClauses,
  DEFAULT_CONVERTED_FILTER,
  normalizeConvertedFilter,
} from '../../../data/transactionList';
import {
  boundsFromGlobalFilters,
  type GlobalTransactionFilters,
} from '../../../filters/globalTransactionFilters';
import {
  fetchStrapiList,
  loadReportTransactions,
  type ReportTransactionStatusFilter,
} from '../shared/reportTransactionStatus';
import { aggregateAssetReconciliation } from './assetReconciliation.aggregate';
import { FIXED_ASSET_ACCOUNT_CODE } from './constants';
import type {
  AssetReconciliationAsset,
  AssetReconciliationReport,
  AssetReconciliationTransaction,
} from './types';

/** Heavy books: same cap as the project balance report. */
const ASSET_RECONCILIATION_TX_MAX_PAGES = 500;

export type AssetReconciliationQueries = {
  transactionStatus: ReportTransactionStatusFilter;
  transactionFilters: Record<string, unknown>;
  assetFilters: Record<string, unknown>;
  /** Balance is computed as of this date (end of the sidebar range). */
  asOf: string;
  /** Stable request key (effect deps). */
  key: string;
};

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Global sidebar filters → Strapi filters, like the other report sections:
 * status, deal expansion (converted), organization and currency apply to both
 * the 1500 rows and the assets; the date range end is the balance date.
 */
export function assetReconciliationQueries(
  state: GlobalTransactionFilters,
  now = new Date(),
): AssetReconciliationQueries {
  const bounds = boundsFromGlobalFilters(state, now);
  const organization = nonEmpty(state.organization);
  const currency = nonEmpty(state.currency_type);
  const converted = convertedToWorkflowFilterClauses(
    normalizeConvertedFilter(state.converted_to_workflow) ?? [
      ...DEFAULT_CONVERTED_FILTER,
    ],
  );

  const txAnd: Record<string, unknown>[] = [
    {
      $or: [
        { debit_account: { code: { $eq: FIXED_ASSET_ACCOUNT_CODE } } },
        { credit_account: { code: { $eq: FIXED_ASSET_ACCOUNT_CODE } } },
      ],
    },
    { date: { $lte: bounds.to } },
  ];
  if (converted.length === 1) txAnd.push(converted[0]!);
  else if (converted.length > 1) txAnd.push({ $or: converted });
  if (organization) {
    txAnd.push({ organization: { documentId: { $eq: organization } } });
  }
  if (currency) txAnd.push({ currency_type: { code: { $eq: currency } } });

  const assetAnd: Record<string, unknown>[] = [];
  if (organization) {
    assetAnd.push({ organization: { documentId: { $eq: organization } } });
  }
  if (currency) assetAnd.push({ currency_type: { code: { $eq: currency } } });

  return {
    transactionStatus: state.status,
    transactionFilters: { $and: txAnd },
    assetFilters: assetAnd.length > 0 ? { $and: assetAnd } : {},
    asOf: bounds.to,
    key: JSON.stringify([
      state.status,
      bounds.to,
      organization,
      currency,
      state.converted_to_workflow,
    ]),
  };
}

type TxRow = {
  documentId?: string;
  date?: string | null;
  amount?: string | number | null;
  description?: string | null;
  debit_account?: { code?: string | number | null } | null;
  credit_account?: { code?: string | number | null } | null;
  currency_type?: { code?: string | null } | null;
  related_transaction?: { documentId?: string | null } | null;
  organization?: { name?: string | null } | null;
};

type AssetRow = {
  documentId?: string;
  name?: string | null;
  ownership_type?: string | null;
  status?: string | null;
  purchase_price?: string | number | null;
  purchase_date?: string | null;
  currency_type?: { code?: string | null } | null;
  acquisition_transaction?: {
    documentId?: string | null;
    date?: string | null;
  } | null;
  organization?: { name?: string | null } | null;
};

function code(value: { code?: string | number | null } | null | undefined) {
  return String(value?.code ?? '').trim();
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapReconciliationTransaction(
  row: TxRow,
): AssetReconciliationTransaction | null {
  if (!row.documentId) return null;
  return {
    documentId: row.documentId,
    date: row.date ?? null,
    amount: toNumber(row.amount),
    description: row.description?.trim() ?? '',
    debitCode: code(row.debit_account),
    creditCode: code(row.credit_account),
    currencyCode: code(row.currency_type),
    relatedDocumentId: row.related_transaction?.documentId ?? null,
    organizationName: row.organization?.name?.trim() ?? '',
  };
}

/**
 * Asset → aggregate input. An asset acquired after the balance date (linked
 * transaction date, else purchase date) is left out, like its 1500 row.
 */
export function mapReconciliationAsset(
  row: AssetRow,
  asOf: string,
): AssetReconciliationAsset | null {
  if (!row.documentId) return null;
  const acquiredOn =
    row.acquisition_transaction?.date ?? row.purchase_date ?? null;
  if (acquiredOn && acquiredOn.slice(0, 10) > asOf) return null;
  const price =
    row.purchase_price == null || row.purchase_price === ''
      ? null
      : Number(row.purchase_price);
  return {
    documentId: row.documentId,
    name: row.name?.trim() ?? '',
    ownershipType: row.ownership_type ?? null,
    status: row.status ?? null,
    purchasePrice: price != null && Number.isFinite(price) ? price : null,
    currencyCode: code(row.currency_type),
    acquisitionTransactionId: row.acquisition_transaction?.documentId ?? null,
    organizationName: row.organization?.name?.trim() ?? '',
  };
}

export async function fetchAssetReconciliation(
  httpClient: ContentHttpClient,
  queries: AssetReconciliationQueries,
): Promise<AssetReconciliationReport> {
  const [txRows, assetRows] = await Promise.all([
    loadReportTransactions<TxRow>(
      httpClient,
      queries.transactionStatus,
      {
        filters: queries.transactionFilters,
        fields: ['documentId', 'date', 'amount', 'description'],
        populate: {
          debit_account: { fields: ['code'] },
          credit_account: { fields: ['code'] },
          currency_type: { fields: ['code'] },
          related_transaction: { fields: ['documentId'] },
          organization: { fields: ['name'] },
        },
        sort: ['date:desc'],
      },
      { maxPages: ASSET_RECONCILIATION_TX_MAX_PAGES },
    ),
    fetchStrapiList<AssetRow>(httpClient, '/api/assets', {
      ...(Object.keys(queries.assetFilters).length > 0
        ? { filters: queries.assetFilters }
        : {}),
      fields: [
        'documentId',
        'name',
        'ownership_type',
        'status',
        'purchase_price',
        'purchase_date',
      ],
      populate: {
        currency_type: { fields: ['code'] },
        acquisition_transaction: { fields: ['documentId', 'date'] },
        organization: { fields: ['name'] },
      },
      sort: ['name:asc'],
    }),
  ]);
  const transactions = txRows
    .map(mapReconciliationTransaction)
    .filter((row): row is AssetReconciliationTransaction => row != null);
  const assets = assetRows
    .map((row) => mapReconciliationAsset(row, queries.asOf))
    .filter((row): row is AssetReconciliationAsset => row != null);
  return aggregateAssetReconciliation(transactions, assets);
}
