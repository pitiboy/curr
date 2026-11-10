import {
  DEFAULT_CONVERTED_FILTER,
  PROJECT_BALANCE_LEG_FILTER_KEY,
} from '../../../data/transactionList';
import {
  boundsForPeriodBucket,
  boundsForPreset,
  type DateRangeBounds,
  type DateRangePreset,
} from '../shared/reportDateRange';
import type { ReportTransactionStatusFilter } from '../shared/reportTransactionStatus';

export type ProjectBalanceLeg = 'revenue' | 'cost';

export type ProjectBalanceDrilldown = {
  organizationId?: string | null;
  currencyCode: string;
  dateFrom: string | null;
  dateTo: string;
  transactionStatus: ReportTransactionStatusFilter;
  leg?: ProjectBalanceLeg | null;
};

export type TransactionListLink = {
  pathname: '/transactions';
  search: string;
};

export type ProjectBalanceDrilldownContext = {
  /** Granularity preset (chart buckets). */
  range: DateRangePreset;
  /** Active report range; defaults to the preset's bounds. */
  bounds?: DateRangeBounds;
  transactionStatus: ReportTransactionStatusFilter;
  currencyCode: string;
  toolbarOrganizationId: string | null;
};

function rangeBounds(context: ProjectBalanceDrilldownContext): DateRangeBounds {
  return context.bounds ?? boundsForPreset(context.range);
}

function listStatusFromReport(
  mode: ReportTransactionStatusFilter,
): 'draft' | 'published' | undefined {
  if (mode === 'preview') return 'published';
  if (mode === 'draft') return 'draft';
  return undefined;
}

function filterRecord(drill: ProjectBalanceDrilldown): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    converted_to_workflow: [...DEFAULT_CONVERTED_FILTER],
    currency_type: drill.currencyCode,
    date_lte: drill.dateTo,
  };
  if (drill.dateFrom) filter.date_gte = drill.dateFrom;
  if (drill.organizationId) filter.organization = drill.organizationId;
  const status = listStatusFromReport(drill.transactionStatus);
  if (status) filter.status = status;
  if (drill.leg === 'revenue' || drill.leg === 'cost') {
    filter[PROJECT_BALANCE_LEG_FILTER_KEY] = drill.leg;
  }
  return filter;
}

function displayedFiltersRecord(
  drill: ProjectBalanceDrilldown,
): Record<string, boolean> {
  return {
    converted_to_workflow: true,
    organization: Boolean(drill.organizationId),
    currency_type: true,
    date_gte: Boolean(drill.dateFrom),
    date_lte: true,
    status: listStatusFromReport(drill.transactionStatus) != null,
  };
}

/** Build `/transactions` list URL with React Admin filter query params. */
export function buildTransactionsDrilldownUrl(
  drill: ProjectBalanceDrilldown,
): TransactionListLink {
  const params = new URLSearchParams();
  params.set('filter', JSON.stringify(filterRecord(drill)));
  params.set('displayedFilters', JSON.stringify(displayedFiltersRecord(drill)));
  return { pathname: '/transactions', search: `?${params.toString()}` };
}

export function drilldownToPath(link: TransactionListLink): string {
  return `${link.pathname}${link.search}`;
}

function baseDrill(
  context: ProjectBalanceDrilldownContext,
  bounds: DateRangeBounds,
): Omit<ProjectBalanceDrilldown, 'organizationId' | 'leg' | 'dateFrom'> {
  return {
    currencyCode: context.currencyCode,
    dateTo: bounds.to,
    transactionStatus: context.transactionStatus,
  };
}

export function drilldownForTableProjectName(
  context: ProjectBalanceDrilldownContext,
  organizationId: string,
): TransactionListLink {
  const bounds = rangeBounds(context);
  return buildTransactionsDrilldownUrl({
    ...baseDrill(context, bounds),
    organizationId,
    dateFrom: bounds.from,
  });
}

export function drilldownForTablePeriodLeg(
  context: ProjectBalanceDrilldownContext,
  organizationId: string,
  leg: ProjectBalanceLeg,
): TransactionListLink {
  const bounds = rangeBounds(context);
  return buildTransactionsDrilldownUrl({
    ...baseDrill(context, bounds),
    organizationId,
    dateFrom: bounds.from,
    leg,
  });
}

export function drilldownForTablePeriodAllLegs(
  context: ProjectBalanceDrilldownContext,
  organizationId: string,
): TransactionListLink {
  const bounds = rangeBounds(context);
  return buildTransactionsDrilldownUrl({
    ...baseDrill(context, bounds),
    organizationId,
    dateFrom: bounds.from,
    leg: null,
  });
}

export function drilldownForTableCumulative(
  context: ProjectBalanceDrilldownContext,
  organizationId: string,
): TransactionListLink {
  const bounds = rangeBounds(context);
  return buildTransactionsDrilldownUrl({
    ...baseDrill(context, bounds),
    organizationId,
    dateFrom: null,
  });
}

export function drilldownForProjectChart(
  context: ProjectBalanceDrilldownContext,
  organizationId: string,
  leg: ProjectBalanceLeg,
): TransactionListLink {
  return drilldownForTablePeriodLeg(context, organizationId, leg);
}

export function drilldownForHistoryChart(
  context: ProjectBalanceDrilldownContext,
  periodKey: string,
  leg: ProjectBalanceLeg,
): TransactionListLink {
  const bucket = boundsForPeriodBucket(periodKey, context.range);
  const orgId = context.toolbarOrganizationId ?? undefined;
  return buildTransactionsDrilldownUrl({
    currencyCode: context.currencyCode,
    dateFrom: bucket.from,
    dateTo: bucket.to,
    transactionStatus: context.transactionStatus,
    organizationId: orgId ?? null,
    leg,
  });
}
