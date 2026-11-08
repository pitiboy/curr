import { strapiHttpClient } from 'ra-strapi';

import type { ContentHttpClient } from '../../../data/receiptDraft';
import { POULTRY_STOCK_ORGANIZATION_NAME } from '../../../workflows/bulk-quantity/poolTransfer';

import { boundsForPreset } from '../eggInventory/dateRange';
import {
  fetchStrapiList,
  loadReportTransactions,
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter,
} from '../shared/reportTransactionStatus';
import {
  aggregatePoultryFlockReport,
  type FlockReportTx,
} from './poultryFlock.aggregate';
import {
  FLOCK_CURRENCIES,
  FLOCK_STOCK_ACCOUNT_CODE,
  type DateRangePreset,
  type PoultryFlockReport,
} from './types';

type OrgRow = {
  documentId?: string;
  name?: string | null;
};

type TxRow = {
  date?: string | null;
  amount?: string | number | null;
  currency_type?: { code?: string | null } | null;
  organization?: { documentId?: string; name?: string | null } | null;
  debit_account?: { code?: string | null; name?: string | null } | null;
  credit_account?: { code?: string | null } | null;
};

const reportPopulate = {
  organization: { fields: ['documentId', 'name'] },
  debit_account: { fields: ['code', 'name'] },
  credit_account: { fields: ['code'] },
  currency_type: { fields: ['code'] },
};

function parseAmount(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function loadHenHouseNames(
  httpClient: ContentHttpClient,
): Promise<Map<string, string>> {
  const parents = await fetchStrapiList<OrgRow>(
    httpClient,
    '/api/organizations',
    {
      filters: { name: { $eq: POULTRY_STOCK_ORGANIZATION_NAME } },
      fields: ['documentId', 'name'],
    },
  );
  const parentId = parents[0]?.documentId;
  const names = new Map<string, string>();
  if (!parentId) return names;
  const children = await fetchStrapiList<OrgRow>(
    httpClient,
    '/api/organizations',
    {
      filters: { parent: { documentId: { $eq: parentId } } },
      fields: ['documentId', 'name'],
      sort: ['name:asc'],
    },
  );
  for (const row of children) {
    if (!row.documentId) continue;
    names.set(row.documentId, row.name?.trim() || row.documentId);
  }
  return names;
}

function mapTx(row: TxRow): FlockReportTx | null {
  if (!row.date) return null;
  const debitCode = String(row.debit_account?.code ?? '').trim();
  const creditCode = String(row.credit_account?.code ?? '').trim();
  const currencyCode = String(row.currency_type?.code ?? '').trim();
  if (!debitCode || !creditCode || !currencyCode) return null;
  return {
    date: row.date,
    amount: parseAmount(row.amount),
    currencyCode,
    debitCode,
    creditCode,
    debitAccountName: row.debit_account?.name?.trim() || undefined,
    orgId: row.organization?.documentId ?? '',
    orgName: row.organization?.name?.trim() ?? '',
  };
}

/**
 * Load HEN / ROOSTER movements on 1300 up to the end of the range (the
 * opening headcount needs history before the range start) and aggregate.
 * Returns null when there is no flock activity at all.
 */
export async function fetchPoultryFlockReport(
  preset: DateRangePreset,
  options: {
    httpClient?: ContentHttpClient;
    transactionStatus?: ReportTransactionStatusFilter;
    now?: Date;
  } = {},
): Promise<PoultryFlockReport | null> {
  const httpClient = options.httpClient ?? strapiHttpClient();
  const transactionStatus =
    options.transactionStatus ?? REPORT_TRANSACTION_STATUS_FILTER_DEFAULT;
  const bounds = boundsForPreset(preset, options.now);

  const [henHouseNames, rows] = await Promise.all([
    loadHenHouseNames(httpClient),
    loadReportTransactions<TxRow>(httpClient, transactionStatus, {
      filters: {
        $and: [
          { date: { $lte: bounds.to } },
          {
            $or: FLOCK_CURRENCIES.map((code) => ({
              currency_type: { code: { $eq: code } },
            })),
          },
          {
            $or: [
              { debit_account: { code: { $eq: FLOCK_STOCK_ACCOUNT_CODE } } },
              { credit_account: { code: { $eq: FLOCK_STOCK_ACCOUNT_CODE } } },
            ],
          },
        ],
      },
      populate: reportPopulate,
      sort: ['date:asc'],
    }),
  ]);

  const txs = rows
    .map(mapTx)
    .filter((row): row is FlockReportTx => row != null && row.amount !== 0);

  return aggregatePoultryFlockReport(txs, { henHouseNames }, preset, bounds);
}
