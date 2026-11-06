import { strapiHttpClient } from 'ra-strapi';

import type { ContentHttpClient } from '../../../data/receiptDraft';

import {
  aggregateMembershipShareReport,
  type MembershipShareMemberRef,
  type MembershipShareTx,
} from './membershipShare.aggregate';
import { boundsForPreset } from './dateRange';
import type { DateRangePreset, MembershipShareReport } from './types';
import { MEMBER_POCKET_ACCOUNT_CODE, MEMBER_SHARE_ACCOUNT_CODE } from './types';
import {
  fetchStrapiList,
  loadReportTransactions,
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter,
} from '../shared/reportTransactionStatus';

type MemberRow = {
  documentId?: string;
  name?: string | null;
  account?: { documentId?: string; code?: string | null } | null;
  private_account?: { documentId?: string; code?: string | null } | null;
};

type TxRow = {
  date?: string | null;
  amount?: string | number | null;
  currency_type?: { code?: string | null } | null;
  debit_account?: {
    documentId?: string;
    code?: string | null;
  } | null;
  credit_account?: {
    documentId?: string;
    code?: string | null;
  } | null;
};

const reportPopulate = {
  debit_account: { fields: ['documentId', 'code'] },
  credit_account: { fields: ['documentId', 'code'] },
  currency_type: { fields: ['code'] },
};

function parseAmount(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function loadMembers(
  httpClient: ContentHttpClient,
): Promise<MembershipShareMemberRef[]> {
  const rows = await fetchStrapiList<MemberRow>(httpClient, '/api/members', {
    fields: ['documentId', 'name'],
    populate: {
      account: { fields: ['documentId', 'code'] },
      private_account: { fields: ['documentId', 'code'] },
    },
    sort: ['name:asc'],
  });

  const out: MembershipShareMemberRef[] = [];
  for (const row of rows) {
    if (!row.documentId || !row.name?.trim()) continue;
    const shareId = row.account?.documentId ?? null;
    const pocketId = row.private_account?.documentId ?? null;
    if (!shareId && !pocketId) continue;
    out.push({
      memberId: row.documentId,
      memberName: row.name.trim(),
      shareAccountId: shareId,
      pocketAccountId: pocketId,
    });
  }
  return out;
}

function mapTx(row: TxRow): MembershipShareTx | null {
  if (!row.date) return null;
  const creditCode = String(row.credit_account?.code ?? '').trim();
  const currencyCode = String(row.currency_type?.code ?? '').trim();
  const creditAccountId = row.credit_account?.documentId ?? '';
  const debitAccountId = row.debit_account?.documentId ?? '';
  if (!creditCode || !currencyCode || !creditAccountId) return null;
  return {
    date: row.date,
    amount: parseAmount(row.amount),
    currencyCode,
    debitAccountId,
    creditAccountId,
    creditCode,
  };
}

async function loadTransactions(
  httpClient: ContentHttpClient,
  preset: DateRangePreset,
  transactionStatus: ReportTransactionStatusFilter,
): Promise<MembershipShareTx[]> {
  const bounds = boundsForPreset(preset);
  const dateFilter: Record<string, string> = { $lte: bounds.to };
  if (bounds.from) dateFilter.$gte = bounds.from;

  const rows = await loadReportTransactions<TxRow>(
    httpClient,
    transactionStatus,
    {
      filters: {
        $and: [
          { date: dateFilter },
          {
            credit_account: {
              code: {
                $in: [MEMBER_SHARE_ACCOUNT_CODE, MEMBER_POCKET_ACCOUNT_CODE],
              },
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
    .filter((row): row is MembershipShareTx => row != null && row.amount !== 0);
}

/**
 * Load 1101/1001 inflows from the Content API and aggregate.
 * Returns null when the range has no matching payments.
 */
export async function fetchMembershipShareReport(
  preset: DateRangePreset,
  options: {
    httpClient?: ContentHttpClient;
    transactionStatus?: ReportTransactionStatusFilter;
  } = {},
): Promise<MembershipShareReport | null> {
  const httpClient = options.httpClient ?? strapiHttpClient();
  const transactionStatus =
    options.transactionStatus ?? REPORT_TRANSACTION_STATUS_FILTER_DEFAULT;

  const [members, txs] = await Promise.all([
    loadMembers(httpClient),
    loadTransactions(httpClient, preset, transactionStatus),
  ]);

  return aggregateMembershipShareReport(txs, members, preset);
}
