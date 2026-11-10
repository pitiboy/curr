import { strapiHttpClient } from 'ra-strapi';

import {
  CONVERTED_ORIGINAL,
  CONVERTED_STORNO,
  convertedToWorkflowFilterClauses,
  DEFAULT_CONVERTED_FILTER,
} from '../../../data/transactionList';
import type { ContentHttpClient } from '../../../data/receiptDraft';

import {
  aggregateMembershipShareReport,
  type MembershipShareMemberRef,
  type MembershipShareTx,
} from './membershipShare.aggregate';
import { boundsForPreset, type DateRangeBounds } from './dateRange';
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
  const debitCode = String(row.debit_account?.code ?? '').trim();
  return {
    date: row.date,
    amount: parseAmount(row.amount),
    currencyCode,
    debitAccountId,
    creditAccountId,
    creditCode,
    debitCode,
  };
}

function keepMembershipShareRow(converted: string | null | undefined): boolean {
  return converted !== CONVERTED_ORIGINAL && converted !== CONVERTED_STORNO;
}

async function loadTransactions(
  httpClient: ContentHttpClient,
  bounds: DateRangeBounds,
  transactionStatus: ReportTransactionStatusFilter,
): Promise<MembershipShareTx[]> {
  const dateFilter: Record<string, string> = { $lte: bounds.to };
  if (bounds.from) dateFilter.$gte = bounds.from;

  const convertedClauses = convertedToWorkflowFilterClauses([
    ...DEFAULT_CONVERTED_FILTER,
  ]);
  const convertedFilter =
    convertedClauses.length === 1
      ? convertedClauses[0]
      : convertedClauses.length > 1
        ? { $or: convertedClauses }
        : {};

  const memberLegFilter = {
    $or: [
      {
        credit_account: {
          code: {
            $in: [MEMBER_SHARE_ACCOUNT_CODE, MEMBER_POCKET_ACCOUNT_CODE],
          },
        },
      },
      {
        debit_account: {
          code: {
            $in: [MEMBER_SHARE_ACCOUNT_CODE, MEMBER_POCKET_ACCOUNT_CODE],
          },
        },
      },
    ],
  };

  const rows = await loadReportTransactions<
    TxRow & { converted_to_workflow?: string | null }
  >(httpClient, transactionStatus, {
    filters: {
      $and: [
        { date: dateFilter },
        ...(Object.keys(convertedFilter).length > 0 ? [convertedFilter] : []),
        memberLegFilter,
      ],
    },
    populate: reportPopulate,
    fields: ['documentId', 'date', 'amount', 'converted_to_workflow'],
    sort: ['date:asc'],
  });

  return rows
    .filter((row) => keepMembershipShareRow(row.converted_to_workflow ?? null))
    .map(mapTx)
    .filter((row): row is MembershipShareTx => row != null && row.amount !== 0);
}

/**
 * Load 1101/1001 external leg movements (credits and debits) from the Content API
 * and aggregate. Excludes ügylet `original` / `storno` rows like the drill-down list.
 * Returns null when the range has no matching payments.
 */
export async function fetchMembershipShareReport(
  preset: DateRangePreset,
  options: {
    httpClient?: ContentHttpClient;
    transactionStatus?: ReportTransactionStatusFilter;
    /** Explicit range (custom dates); defaults to the preset's bounds. */
    bounds?: DateRangeBounds;
  } = {},
): Promise<MembershipShareReport | null> {
  const httpClient = options.httpClient ?? strapiHttpClient();
  const transactionStatus =
    options.transactionStatus ?? REPORT_TRANSACTION_STATUS_FILTER_DEFAULT;

  const [members, txs] = await Promise.all([
    loadMembers(httpClient),
    loadTransactions(
      httpClient,
      options.bounds ?? boundsForPreset(preset),
      transactionStatus,
    ),
  ]);

  return aggregateMembershipShareReport(txs, members, preset);
}
