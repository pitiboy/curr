import {
  DEFAULT_CONVERTED_FILTER,
  MEMBER_LEDGER_ACCOUNT_IN_FILTER_KEY,
  MEMBERSHIP_LEDGER_MODE_FILTER_KEY,
  MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY,
  type ConvertedFilterValue,
  type MembershipLedgerModeFilter,
} from '../../../data/transactionList';
import {
  boundsForPreset,
  type DateRangeBounds,
  type DateRangePreset,
} from '../shared/reportDateRange';
import type { ReportTransactionStatusFilter } from '../shared/reportTransactionStatus';
import type { MembershipLedgerMemberRow } from './types';

export type MembershipLedgerLeg = 'share' | 'pocket';
export type MembershipLedgerColumn = 'payment' | 'deduction' | 'balance';

/**
 * Same cohort as membership-ledger fetch: `none` + `expanded` (no original/storno).
 */
export const MEMBERSHIP_LEDGER_DRILLDOWN_CONVERTED_FILTER: ConvertedFilterValue[] =
  [...DEFAULT_CONVERTED_FILTER];

export type TransactionListLink = {
  pathname: '/transactions';
  search: string;
};

export type MembershipLedgerDrilldownContext = {
  range: DateRangePreset;
  bounds?: DateRangeBounds;
  transactionStatus: ReportTransactionStatusFilter;
  currencyCode: string;
};

type MembershipLedgerDrilldown = {
  currencyCode: string;
  dateFrom: string | null;
  dateTo: string;
  transactionStatus: ReportTransactionStatusFilter;
  mode: MembershipLedgerModeFilter;
  creditAccountId?: string | null;
  debitAccountId?: string | null;
  memberLedgerAccountIn?: string[] | null;
};

function rangeBounds(
  context: MembershipLedgerDrilldownContext,
): DateRangeBounds {
  return context.bounds ?? boundsForPreset(context.range);
}

function listStatusFromReport(
  mode: ReportTransactionStatusFilter,
): 'draft' | 'published' | undefined {
  if (mode === 'preview') return 'published';
  if (mode === 'draft') return 'draft';
  return undefined;
}

function accountIdForLeg(
  member: Pick<MembershipLedgerMemberRow, 'shareAccountId' | 'pocketAccountId'>,
  leg: MembershipLedgerLeg,
): string | null {
  return leg === 'share' ? member.shareAccountId : member.pocketAccountId;
}

function filterRecord(
  drill: MembershipLedgerDrilldown,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    converted_to_workflow: [...MEMBERSHIP_LEDGER_DRILLDOWN_CONVERTED_FILTER],
    currency_type: drill.currencyCode,
    date_lte: drill.dateTo,
    [MEMBERSHIP_LEDGER_MODE_FILTER_KEY]: drill.mode,
  };
  if (drill.dateFrom) filter.date_gte = drill.dateFrom;
  const status = listStatusFromReport(drill.transactionStatus);
  if (status) filter.status = status;

  if (drill.memberLedgerAccountIn && drill.memberLedgerAccountIn.length > 0) {
    filter[MEMBER_LEDGER_ACCOUNT_IN_FILTER_KEY] = drill.memberLedgerAccountIn;
  } else if (drill.mode === 'payment' && drill.creditAccountId) {
    filter.credit_account = drill.creditAccountId;
    filter[MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY] = true;
  } else if (drill.mode === 'deduction' && drill.debitAccountId) {
    filter.debit_account = drill.debitAccountId;
  }

  return filter;
}

function displayedFiltersRecord(
  drill: MembershipLedgerDrilldown,
): Record<string, boolean> {
  return {
    converted_to_workflow: true,
    currency_type: true,
    date_gte: Boolean(drill.dateFrom),
    date_lte: true,
    status: listStatusFromReport(drill.transactionStatus) != null,
    credit_account: Boolean(drill.creditAccountId) && drill.mode === 'payment',
    debit_account: Boolean(drill.debitAccountId) && drill.mode === 'deduction',
  };
}

export function buildTransactionsDrilldownUrl(
  drill: MembershipLedgerDrilldown,
): TransactionListLink {
  const params = new URLSearchParams();
  params.set('filter', JSON.stringify(filterRecord(drill)));
  params.set('displayedFilters', JSON.stringify(displayedFiltersRecord(drill)));
  return { pathname: '/transactions', search: `?${params.toString()}` };
}

function baseDrill(
  context: MembershipLedgerDrilldownContext,
  bounds: DateRangeBounds,
  mode: MembershipLedgerModeFilter,
): Pick<
  MembershipLedgerDrilldown,
  'currencyCode' | 'dateFrom' | 'dateTo' | 'transactionStatus' | 'mode'
> {
  return {
    currencyCode: context.currencyCode,
    dateFrom: bounds.from,
    dateTo: bounds.to,
    transactionStatus: context.transactionStatus,
    mode,
  };
}

/** Tag név: mindkét számla, befizetés + kivét (balance mód). */
export function drilldownForMemberRow(
  context: MembershipLedgerDrilldownContext,
  member: MembershipLedgerMemberRow,
): TransactionListLink {
  const bounds = rangeBounds(context);
  const ids = [member.shareAccountId, member.pocketAccountId].filter(
    (id): id is string => Boolean(id),
  );
  return buildTransactionsDrilldownUrl({
    ...baseDrill(context, bounds, 'balance'),
    memberLedgerAccountIn: ids.length > 0 ? ids : null,
  });
}

/** Egy összeg cella: payment / deduction / balance × share / pocket. */
export function drilldownForMemberCell(
  context: MembershipLedgerDrilldownContext,
  member: MembershipLedgerMemberRow,
  leg: MembershipLedgerLeg,
  column: MembershipLedgerColumn,
): TransactionListLink {
  const bounds = rangeBounds(context);
  const accountId = accountIdForLeg(member, leg);

  if (column === 'balance') {
    return buildTransactionsDrilldownUrl({
      ...baseDrill(context, bounds, 'balance'),
      memberLedgerAccountIn: accountId ? [accountId] : null,
    });
  }

  if (column === 'payment') {
    return buildTransactionsDrilldownUrl({
      ...baseDrill(context, bounds, 'payment'),
      creditAccountId: accountId,
    });
  }

  return buildTransactionsDrilldownUrl({
    ...baseDrill(context, bounds, 'deduction'),
    debitAccountId: accountId,
  });
}
