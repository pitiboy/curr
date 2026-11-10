import { strapiHttpClient } from 'ra-strapi';

import type { AccountCodePatterns } from '../../../data/accountCodes';
import {
  CONVERTED_EXPANDED,
  convertedToWorkflowFilterClauses,
  DEFAULT_CONVERTED_FILTER,
  type ConvertedToWorkflow,
} from '../../../data/transactionList';
import type { ContentHttpClient } from '../../../data/receiptDraft';
import {
  boundsForPreset,
  type DateRangeBounds,
  type DateRangePreset,
} from '../shared/reportDateRange';
import {
  fetchStrapiList,
  loadReportTransactions,
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter,
} from '../shared/reportTransactionStatus';

import {
  aggregateProjectBalanceReport,
  mapTxToProjectBalance,
} from './projectBalance.aggregate';
import type { ProjectBalanceReport } from './types';

type TxRow = {
  date?: string | null;
  amount?: string | number | null;
  converted_to_workflow?: ConvertedToWorkflow | null;
  currency_type?: { code?: string | null } | null;
  organization?: { documentId?: string; name?: string | null } | null;
  debit_account?: { code?: string | null } | null;
  credit_account?: { code?: string | null } | null;
};

export type OrganizationOption = {
  documentId: string;
  name: string;
};

const reportPopulate = {
  organization: { fields: ['documentId', 'name'] },
  debit_account: { fields: ['code'] },
  credit_account: { fields: ['code'] },
  currency_type: { fields: ['code'] },
};

/** Project balance needs full history; default report cap (50×100) is too low for kor scale. */
const PROJECT_BALANCE_TX_MAX_PAGES = 500;
const REPORT_PAGE_SIZE = 100;

function keepConvertedRow(value: unknown): boolean {
  if (value == null || value === '') return true;
  return value === CONVERTED_EXPANDED;
}

export async function fetchProjectBalanceOrganizations(
  httpClient: ContentHttpClient = strapiHttpClient(),
): Promise<OrganizationOption[]> {
  const rows = await fetchStrapiList<{
    documentId?: string;
    name?: string | null;
  }>(httpClient, '/api/organizations', {
    fields: ['documentId', 'name'],
    sort: ['name:asc'],
  });
  return rows
    .filter((row) => row.documentId && row.name?.trim())
    .map((row) => ({
      documentId: row.documentId!,
      name: row.name!.trim(),
    }));
}

/**
 * Load transactions through range end and aggregate project cost/revenue.
 */
export async function fetchProjectBalanceReport(
  preset: DateRangePreset,
  options: {
    patterns: AccountCodePatterns;
    httpClient?: ContentHttpClient;
    transactionStatus?: ReportTransactionStatusFilter;
    organizationId?: string | null;
    /** Explicit range (custom dates); defaults to the preset's bounds. */
    bounds?: DateRangeBounds;
  },
): Promise<ProjectBalanceReport | null> {
  const httpClient = options.httpClient ?? strapiHttpClient();
  const transactionStatus =
    options.transactionStatus ?? REPORT_TRANSACTION_STATUS_FILTER_DEFAULT;
  const bounds = options.bounds ?? boundsForPreset(preset);

  const convertedClauses = convertedToWorkflowFilterClauses([
    ...DEFAULT_CONVERTED_FILTER,
  ]);
  const convertedFilter =
    convertedClauses.length === 1
      ? convertedClauses[0]
      : convertedClauses.length > 1
        ? { $or: convertedClauses }
        : {};

  const orgClause = options.organizationId
    ? {
        organization: {
          documentId: { $eq: options.organizationId },
        },
      }
    : null;

  const andFilters: Record<string, unknown>[] = [
    { date: { $lte: bounds.to } },
    ...(Object.keys(convertedFilter).length > 0 ? [convertedFilter] : []),
    ...(orgClause ? [orgClause] : []),
  ];

  const rows = await loadReportTransactions<TxRow>(
    httpClient,
    transactionStatus,
    {
      filters: { $and: andFilters },
      populate: reportPopulate,
      sort: ['date:asc'],
    },
    { maxPages: PROJECT_BALANCE_TX_MAX_PAGES },
  );

  const loadTruncated =
    rows.length >= PROJECT_BALANCE_TX_MAX_PAGES * REPORT_PAGE_SIZE;

  const txs = [];
  let unclassifiedCount = 0;
  for (const row of rows) {
    if (!keepConvertedRow(row.converted_to_workflow)) continue;
    const mapped = mapTxToProjectBalance(row, options.patterns);
    if (mapped) {
      txs.push(mapped);
      continue;
    }
    const amount =
      typeof row.amount === 'number' ? row.amount : Number(row.amount);
    const hasOrg = Boolean(
      row.organization?.documentId && row.organization?.name?.trim(),
    );
    const hasAccounts = Boolean(
      row.debit_account?.code?.trim() && row.credit_account?.code?.trim(),
    );
    if (
      hasOrg &&
      hasAccounts &&
      row.date &&
      Number.isFinite(amount) &&
      amount !== 0
    ) {
      unclassifiedCount += 1;
    }
  }

  return aggregateProjectBalanceReport(txs, preset, {
    bounds,
    organizationId: options.organizationId ?? null,
    unclassifiedCount,
    loadTruncated,
  });
}
