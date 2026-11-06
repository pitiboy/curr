import { strapiHttpClient } from 'ra-strapi';

import { STRAPI_URL } from '../../../config';
import type { ContentHttpClient } from '../../../data/receiptDraft';
import { encodeStrapiQuery } from '../../../data/transactionList';
import {
  DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE,
  DISTRIBUTION_SALE_CASH_ACCOUNT_CODE,
  EGG_PRODUCTION_CREDIT_ACCOUNT_CODE,
  EGG_PRODUCTION_DEBIT_ACCOUNT_CODE,
} from '../../../workflows/bulk-quantity/eggDailyEntry.constants';
import { POULTRY_STOCK_ORGANIZATION_NAME } from '../../../workflows/bulk-quantity/poolTransfer';

import {
  aggregateEggInventoryReport,
  type EggReportCatalog,
  type EggReportMemberRef,
  type EggReportTx,
} from './eggInventory.aggregate';
import { boundsForPreset } from './dateRange';
import type { DateRangePreset, EggInventoryReport } from './types';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

type ListResponse<T> = {
  data?: T[];
  meta?: { pagination?: { pageCount?: number } };
};

type OrgRow = {
  documentId?: string;
  name?: string | null;
};

type MemberRow = {
  documentId?: string;
  name?: string | null;
  private_account?: { documentId?: string; code?: string | null } | null;
};

type TxRow = {
  date?: string | null;
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

async function fetchAllPages<T>(
  httpClient: ContentHttpClient,
  path: string,
  queryBase: Record<string, unknown>,
): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const query = encodeStrapiQuery({
      ...queryBase,
      pagination: { page, pageSize: PAGE_SIZE, withCount: true },
    });
    const { json } = (await httpClient(`${STRAPI_URL}${path}?${query}`)) as {
      json: ListResponse<T>;
    };
    rows.push(...(json.data ?? []));
    pageCount = json.meta?.pagination?.pageCount ?? 1;
    page += 1;
  } while (page <= pageCount && page <= MAX_PAGES);
  return rows;
}

async function loadHenHouses(
  httpClient: ContentHttpClient,
): Promise<{ ids: Set<string>; names: Map<string, string> }> {
  const parents = await fetchAllPages<OrgRow>(
    httpClient,
    '/api/organizations',
    {
      filters: { name: { $eq: POULTRY_STOCK_ORGANIZATION_NAME } },
      fields: ['documentId', 'name'],
    },
  );
  const parentId = parents[0]?.documentId;
  if (!parentId) {
    return { ids: new Set(), names: new Map() };
  }
  const children = await fetchAllPages<OrgRow>(
    httpClient,
    '/api/organizations',
    {
      filters: { parent: { documentId: { $eq: parentId } } },
      fields: ['documentId', 'name'],
      sort: ['name:asc'],
    },
  );
  const ids = new Set<string>();
  const names = new Map<string, string>();
  for (const row of children) {
    if (!row.documentId) continue;
    ids.add(row.documentId);
    names.set(row.documentId, row.name?.trim() || row.documentId);
  }
  return { ids, names };
}

async function loadMembers(
  httpClient: ContentHttpClient,
): Promise<EggReportMemberRef[]> {
  // All members with a private pocket — distribution is not limited to
  // Tyúktartás membership (sheet imports debit saját:* for any member).
  const rows = await fetchAllPages<MemberRow>(httpClient, '/api/members', {
    fields: ['documentId', 'name'],
    populate: {
      private_account: { fields: ['documentId', 'code'] },
    },
    sort: ['name:asc'],
  });

  const out: EggReportMemberRef[] = [];
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

function mapTx(row: TxRow): EggReportTx | null {
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
    debitAccountId: row.debit_account?.documentId ?? '',
    creditAccountId: row.credit_account?.documentId ?? '',
    debitAccountName: row.debit_account?.name?.trim() || undefined,
    orgId: row.organization?.documentId ?? '',
    orgName: row.organization?.name?.trim() ?? '',
  };
}

async function loadTransactions(
  httpClient: ContentHttpClient,
  preset: DateRangePreset,
  saleCurrency: string,
): Promise<EggReportTx[]> {
  const bounds = boundsForPreset(preset);
  const dateFilter: Record<string, string> = { $lte: bounds.to };
  if (bounds.from) dateFilter.$gte = bounds.from;

  const rows = await fetchAllPages<TxRow>(httpClient, '/api/transactions', {
    status: 'published',
    filters: {
      $and: [
        { date: dateFilter },
        {
          $or: [
            { currency_type: { code: { $eq: 'EGG' } } },
            { currency_type: { code: { $eq: saleCurrency } } },
          ],
        },
      ],
    },
    populate: reportPopulate,
    sort: ['date:asc'],
  });

  return rows
    .map(mapTx)
    .filter((row): row is EggReportTx => row != null && row.amount !== 0);
}

/**
 * Load published egg inventory data from the Content API and aggregate.
 * Returns null when the range has no matching activity.
 */
export async function fetchEggInventoryReport(
  preset: DateRangePreset,
  options: {
    saleCurrency?: string;
    httpClient?: ContentHttpClient;
  } = {},
): Promise<EggInventoryReport | null> {
  const httpClient = options.httpClient ?? strapiHttpClient();
  const saleCurrency = options.saleCurrency?.trim() || 'HUF';

  const [henHouses, members, txs] = await Promise.all([
    loadHenHouses(httpClient),
    loadMembers(httpClient),
    loadTransactions(httpClient, preset, saleCurrency),
  ]);

  // Drop unrelated HUF noise client-side (keep EGG + sale cash legs).
  const relevant = txs.filter((tx) => {
    if (tx.currencyCode === 'EGG') {
      return (
        (tx.debitCode === EGG_PRODUCTION_DEBIT_ACCOUNT_CODE &&
          tx.creditCode === EGG_PRODUCTION_CREDIT_ACCOUNT_CODE) ||
        tx.creditCode === EGG_PRODUCTION_DEBIT_ACCOUNT_CODE
      );
    }
    if (tx.currencyCode === saleCurrency) {
      return tx.debitCode === DISTRIBUTION_SALE_CASH_ACCOUNT_CODE;
    }
    return false;
  });

  const catalog: EggReportCatalog = {
    henHouseIds: henHouses.ids,
    henHouseNames: henHouses.names,
    members,
    saleCurrency,
  };

  return aggregateEggInventoryReport(relevant, catalog, preset);
}
