import {
  CONVERTED_ORIGINAL,
  CREDIT_ACCOUNT_IN_FILTER_KEY,
  DEFAULT_CONVERTED_FILTER,
  MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY,
  type ConvertedFilterValue,
} from '../../../data/transactionList';
import {
  boundsForPeriodBucket,
  boundsForPreset,
  type DateRangeBounds,
  type DateRangePreset,
} from '../shared/reportDateRange';
import type { ReportTransactionStatusFilter } from '../shared/reportTransactionStatus';
import type { LedgerFocus, MembershipMemberRow } from './types';
import { MEMBER_POCKET_ACCOUNT_CODE, MEMBER_SHARE_ACCOUNT_CODE } from './types';

export type MembershipShareLedgerLeg = 'share' | 'pocket';

/**
 * Report load does not cap `converted_to_workflow`, so ügylet-kifejtés utáni
 * `original` forrás sorok is benne vannak. A lista alapértelmezése ezeket rejti.
 */
export const MEMBERSHIP_SHARE_DRILLDOWN_CONVERTED_FILTER: ConvertedFilterValue[] =
  [...DEFAULT_CONVERTED_FILTER, CONVERTED_ORIGINAL];

export type TransactionListLink = {
  pathname: '/transactions';
  search: string;
};

export type MembershipShareDrilldownContext = {
  range: DateRangePreset;
  transactionStatus: ReportTransactionStatusFilter;
  focus: LedgerFocus;
};

type MembershipShareDrilldown = {
  currencyCode?: string | null;
  dateFrom: string | null;
  dateTo: string;
  transactionStatus: ReportTransactionStatusFilter;
  creditAccountId?: string | null;
  creditAccountIn?: string[] | null;
  creditAccountCode?: string | null;
};

function listStatusFromReport(
  mode: ReportTransactionStatusFilter,
): 'draft' | 'published' | undefined {
  if (mode === 'preview') return 'published';
  if (mode === 'draft') return 'draft';
  return undefined;
}

function creditTargets(
  member: Pick<MembershipMemberRow, 'shareAccountId' | 'pocketAccountId'>,
  leg: LedgerFocus | MembershipShareLedgerLeg,
): {
  creditAccountId?: string;
  creditAccountIn?: string[];
  creditAccountCode?: string;
} {
  if (leg === 'share' && member.shareAccountId) {
    return { creditAccountId: member.shareAccountId };
  }
  if (leg === 'pocket' && member.pocketAccountId) {
    return { creditAccountId: member.pocketAccountId };
  }
  const ids = [member.shareAccountId, member.pocketAccountId].filter(
    (id): id is string => Boolean(id),
  );
  if (ids.length === 1) return { creditAccountId: ids[0] };
  if (ids.length > 1) return { creditAccountIn: ids };
  return {};
}

function filterRecord(
  drill: MembershipShareDrilldown,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    converted_to_workflow: [...MEMBERSHIP_SHARE_DRILLDOWN_CONVERTED_FILTER],
    date_lte: drill.dateTo,
    [MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY]: true,
  };
  if (drill.currencyCode?.trim()) {
    filter.currency_type = drill.currencyCode.trim();
  }
  if (drill.dateFrom) filter.date_gte = drill.dateFrom;
  const status = listStatusFromReport(drill.transactionStatus);
  if (status) filter.status = status;
  if (drill.creditAccountIn && drill.creditAccountIn.length > 0) {
    filter[CREDIT_ACCOUNT_IN_FILTER_KEY] = drill.creditAccountIn;
  } else if (drill.creditAccountId) {
    filter.credit_account = drill.creditAccountId;
  } else if (drill.creditAccountCode) {
    filter.credit_account_code = drill.creditAccountCode;
  }
  return filter;
}

function displayedFiltersRecord(
  drill: MembershipShareDrilldown,
): Record<string, boolean> {
  const hasCredit =
    Boolean(drill.creditAccountId) ||
    Boolean(drill.creditAccountIn?.length) ||
    Boolean(drill.creditAccountCode);
  return {
    converted_to_workflow: true,
    currency_type: Boolean(drill.currencyCode?.trim()),
    date_gte: Boolean(drill.dateFrom),
    date_lte: true,
    status: listStatusFromReport(drill.transactionStatus) != null,
    credit_account: hasCredit && !drill.creditAccountIn?.length,
  };
}

export function buildTransactionsDrilldownUrl(
  drill: MembershipShareDrilldown,
): TransactionListLink {
  const params = new URLSearchParams();
  params.set('filter', JSON.stringify(filterRecord(drill)));
  params.set('displayedFilters', JSON.stringify(displayedFiltersRecord(drill)));
  return { pathname: '/transactions', search: `?${params.toString()}` };
}

function baseDrill(
  context: MembershipShareDrilldownContext,
  bounds: DateRangeBounds,
  currencyCode: string | null,
): Omit<
  MembershipShareDrilldown,
  'creditAccountId' | 'creditAccountIn' | 'creditAccountCode'
> {
  return {
    currencyCode,
    dateFrom: bounds.from,
    dateTo: bounds.to,
    transactionStatus: context.transactionStatus,
  };
}

function legForContext(
  context: MembershipShareDrilldownContext,
  seriesLeg?: MembershipShareLedgerLeg,
): LedgerFocus | MembershipShareLedgerLeg {
  if (seriesLeg) return seriesLeg;
  return context.focus;
}

export function drilldownForMemberCell(
  context: MembershipShareDrilldownContext,
  member: MembershipMemberRow,
  currencyCode: string,
  leg: MembershipShareLedgerLeg,
): TransactionListLink {
  const bounds = boundsForPreset(context.range);
  const credit = creditTargets(member, leg);
  return buildTransactionsDrilldownUrl({
    ...baseDrill(context, bounds, currencyCode),
    ...credit,
  });
}

export function drilldownForMemberRow(
  context: MembershipShareDrilldownContext,
  member: MembershipMemberRow,
): TransactionListLink {
  const bounds = boundsForPreset(context.range);
  const leg = legForContext(context);
  const credit = creditTargets(member, leg);
  return buildTransactionsDrilldownUrl({
    ...baseDrill(context, bounds, null),
    ...credit,
  });
}

export function drilldownForMemberBar(
  context: MembershipShareDrilldownContext,
  member: MembershipMemberRow,
  leg: MembershipShareLedgerLeg,
  currencyCode: string,
): TransactionListLink {
  return drilldownForMemberCell(context, member, currencyCode, leg);
}

export function drilldownForPieSlice(
  context: MembershipShareDrilldownContext,
  sliceId: string,
  currencyCode: string,
): TransactionListLink {
  const bounds = boundsForPreset(context.range);
  if (context.focus === 'both') {
    const code =
      sliceId === 'pocket'
        ? MEMBER_POCKET_ACCOUNT_CODE
        : MEMBER_SHARE_ACCOUNT_CODE;
    return buildTransactionsDrilldownUrl({
      ...baseDrill(context, bounds, currencyCode),
      creditAccountCode: code,
    });
  }
  return buildTransactionsDrilldownUrl({
    ...baseDrill(context, bounds, sliceId),
    creditAccountCode:
      context.focus === 'share'
        ? MEMBER_SHARE_ACCOUNT_CODE
        : MEMBER_POCKET_ACCOUNT_CODE,
  });
}

export function drilldownForHistoryBar(
  context: MembershipShareDrilldownContext,
  member: MembershipMemberRow,
  periodKey: string,
  currencyCode: string,
  seriesLeg?: MembershipShareLedgerLeg,
): TransactionListLink {
  const bucket = boundsForPeriodBucket(periodKey, context.range);
  const leg = legForContext(context, seriesLeg);
  const credit = creditTargets(member, leg);
  return buildTransactionsDrilldownUrl({
    currencyCode,
    dateFrom: bucket.from,
    dateTo: bucket.to,
    transactionStatus: context.transactionStatus,
    ...credit,
  });
}
