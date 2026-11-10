import { strapiHttpClient } from 'ra-strapi';

import type { ContentHttpClient } from '../../../data/receiptDraft';
import { DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE } from '../../../workflows/bulk-quantity/eggDailyEntry.constants';

import {
  aggregateHenInventoryReport,
  type HenReportCatalog,
  type HenReportMemberRef,
  type HenReportTx,
} from './henInventory.aggregate';
import {
  HEN_INVENTORY_ACCOUNT_CODE,
  POULTRY_INVENTORY_CURRENCY_CODES,
} from './henInventory.constants';
import type { HenInventoryReport } from './types';
import {
  boundsForPreset,
  type DateRangeBounds,
  type DateRangePreset,
} from '../shared/reportDateRange';
import { loadPoultryHenHouses } from '../shared/poultryHenHouses';
import {
  fetchStrapiList,
  loadReportTransactions,
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter,
} from '../shared/reportTransactionStatus';

type MemberRow = {
  documentId?: string;
  name?: string | null;
  private_account?: { documentId?: string; code?: string | null } | null;
};

type TxRow = {
  date?: string | null;
  description?: string | null;
  amount?: string | number | null;
  currency_type?: { code?: string | null } | null;
  organization?: { documentId?: string; name?: string | null } | null;
  debit_account?: {
    documentId?: string;
    code?: string | null;
    name?: string | null;
  } | null;
  credit_account?: {
    documentId?: string;
    code?: string | null;
    name?: string | null;
  } | null;
};

const reportPopulate = {
  organization: { fields: ['documentId', 'name'] },
  debit_account: { fields: ['documentId', 'code', 'name'] },
  credit_account: { fields: ['documentId', 'code', 'name'] },
  currency_type: { fields: ['code'] },
};

function parseAmount(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function loadMembers(
  httpClient: ContentHttpClient,
): Promise<HenReportMemberRef[]> {
  const rows = await fetchStrapiList<MemberRow>(httpClient, '/api/members', {
    fields: ['documentId', 'name'],
    populate: {
      private_account: { fields: ['documentId', 'code'] },
    },
    sort: ['name:asc'],
  });

  const out: HenReportMemberRef[] = [];
  for (const member of rows) {
    if (!member?.documentId || !member.name?.trim()) continue;
    const privateId = member.private_account?.documentId ?? null;
    if (!privateId) continue;
    out.push({
      memberId: member.documentId,
      memberName: member.name.trim(),
      privateAccountId: privateId,
      privateAccountCode:
        member.private_account?.code ??
        DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE,
    });
  }
  return out;
}

function mapTx(row: TxRow): HenReportTx | null {
  if (!row.date) return null;
  const debitCode = String(row.debit_account?.code ?? '').trim();
  const creditCode = String(row.credit_account?.code ?? '').trim();
  const currencyCode = String(row.currency_type?.code ?? '').trim();
  if (!debitCode || !creditCode || !currencyCode) return null;
  return {
    date: row.date,
    description: row.description?.trim() || undefined,
    amount: parseAmount(row.amount),
    currencyCode,
    debitCode,
    creditCode,
    debitAccountId: row.debit_account?.documentId ?? '',
    debitAccountName: row.debit_account?.name?.trim() || undefined,
    orgId: row.organization?.documentId ?? '',
    orgName: row.organization?.name?.trim() ?? '',
  };
}

async function loadTransactions(
  httpClient: ContentHttpClient,
  bounds: DateRangeBounds,
  transactionStatus: ReportTransactionStatusFilter,
): Promise<HenReportTx[]> {
  const dateFilter: Record<string, string> = { $lte: bounds.to };

  const rows = await loadReportTransactions<TxRow>(
    httpClient,
    transactionStatus,
    {
      filters: {
        $and: [
          { date: dateFilter },
          {
            currency_type: {
              code: { $in: [...POULTRY_INVENTORY_CURRENCY_CODES] },
            },
          },
        ],
      },
      populate: reportPopulate,
      sort: ['date:asc'],
    },
  );

  return rows
    .map(mapTx)
    .filter(
      (row): row is HenReportTx =>
        row != null &&
        row.amount !== 0 &&
        (row.debitCode === HEN_INVENTORY_ACCOUNT_CODE ||
          row.creditCode === HEN_INVENTORY_ACCOUNT_CODE),
    );
}

export async function fetchHenInventoryReport(
  preset: DateRangePreset,
  options: {
    httpClient?: ContentHttpClient;
    transactionStatus?: ReportTransactionStatusFilter;
    /** Explicit range (custom dates); defaults to the preset's bounds. */
    bounds?: DateRangeBounds;
  } = {},
): Promise<HenInventoryReport | null> {
  const bounds = options.bounds ?? boundsForPreset(preset);
  const httpClient = options.httpClient ?? strapiHttpClient();
  const transactionStatus =
    options.transactionStatus ?? REPORT_TRANSACTION_STATUS_FILTER_DEFAULT;

  const [henHouses, members, txs] = await Promise.all([
    loadPoultryHenHouses(httpClient),
    loadMembers(httpClient),
    loadTransactions(httpClient, bounds, transactionStatus),
  ]);

  const catalog: HenReportCatalog = {
    henHouseIds: henHouses.ids,
    henHouseNames: henHouses.names,
    poultryParentOrgId: henHouses.parentId,
    members,
  };

  return aggregateHenInventoryReport(txs, catalog, preset, new Date(), bounds);
}
