/**
 * Global transaction filters shared by the sidebar panel, the transaction
 * list and the report pages. Pure helpers only (Vitest node); the Jotai atom
 * lives in `globalTransactionFiltersAtom.ts`.
 */
import {
  CONVERTED_TO_WORKFLOW_CHOICES,
  DEFAULT_CONVERTED_FILTER,
  type ConvertedFilterValue,
} from '../data/transactionList';
import {
  boundsForPreset,
  toIsoDate,
  type DateRangeBounds,
  type DateRangePreset,
} from '../pages/reports/shared/reportDateRange';
import type { ReportTransactionStatusFilter } from '../pages/reports/shared/reportTransactionStatus';

export type GlobalDatePreset = DateRangePreset | 'custom';

export type GlobalTransactionFilters = {
  datePreset: GlobalDatePreset;
  date_gte?: string;
  date_lte?: string;
  status: ReportTransactionStatusFilter;
  converted_to_workflow: ConvertedFilterValue[];
  createdAt_gte?: string;
  createdAt_lte?: string;
  amount_gte?: number;
  amount_lte?: number;
  organization?: string;
  debit_account?: string;
  credit_account?: string;
  description?: string;
  vendor?: string;
  /**
   * Report drill-down keys without their own sidebar control
   * (`currency_type`, `project_balance_leg`, `credit_account_in`, …).
   * Passed through to the list filter verbatim; cleared by reset / menu.
   */
  drilldown?: Record<string, unknown>;
};

export type GlobalOptionalFilterKey =
  | 'date'
  | 'createdAt'
  | 'amount'
  | 'organization'
  | 'debit_account'
  | 'credit_account'
  | 'description'
  | 'vendor';

/** Order of the „Szűrő hozzáadása” menu. */
export const GLOBAL_OPTIONAL_FILTER_KEYS: readonly GlobalOptionalFilterKey[] = [
  'date',
  'createdAt',
  'amount',
  'organization',
  'debit_account',
  'credit_account',
  'description',
  'vendor',
] as const;

export type TransactionMenuMode = 'all' | 'draft';

/** Review menu: every deal-expansion value selected. */
export const REVIEW_CONVERTED_FILTER: ConvertedFilterValue[] = [
  ...CONVERTED_TO_WORKFLOW_CHOICES,
];

/** 2A default snapshot: this month, published books, hide original + storno. */
export function resetGlobalFilters(): GlobalTransactionFilters {
  return {
    datePreset: 'thisMonth',
    status: 'preview',
    converted_to_workflow: [...DEFAULT_CONVERTED_FILTER],
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Whether an optional (non-always-on) filter currently holds a value. */
export function optionalFilterHasValue(
  state: GlobalTransactionFilters,
  key: GlobalOptionalFilterKey,
): boolean {
  switch (key) {
    case 'date':
      return state.datePreset === 'custom';
    case 'createdAt':
      return (
        isNonEmptyString(state.createdAt_gte) ||
        isNonEmptyString(state.createdAt_lte)
      );
    case 'amount':
      return (
        isFiniteNumber(state.amount_gte) || isFiniteNumber(state.amount_lte)
      );
    default:
      return isNonEmptyString(state[key]);
  }
}

/** Remove an optional filter's value(s). `date` falls back to the default preset. */
export function clearOptionalFilter(
  state: GlobalTransactionFilters,
  key: GlobalOptionalFilterKey,
): GlobalTransactionFilters {
  const next = { ...state };
  switch (key) {
    case 'date':
      delete next.date_gte;
      delete next.date_lte;
      if (next.datePreset === 'custom') {
        next.datePreset = resetGlobalFilters().datePreset;
      }
      return next;
    case 'createdAt':
      delete next.createdAt_gte;
      delete next.createdAt_lte;
      return next;
    case 'amount':
      delete next.amount_gte;
      delete next.amount_lte;
      return next;
    default:
      delete next[key];
      return next;
  }
}

/** Preset button: select it and drop any custom date bounds. */
export function selectDatePreset(
  state: GlobalTransactionFilters,
  preset: DateRangePreset,
): GlobalTransactionFilters {
  const next: GlobalTransactionFilters = { ...state, datePreset: preset };
  delete next.date_gte;
  delete next.date_lte;
  return next;
}

/** Switch to custom range, seeding bounds from the active preset when needed. */
export function enterCustomDatePreset(
  state: GlobalTransactionFilters,
  now = new Date(),
): GlobalTransactionFilters {
  if (state.datePreset === 'custom') return state;
  const bounds = boundsForPreset(state.datePreset, now);
  const next: GlobalTransactionFilters = { ...state, datePreset: 'custom' };
  if (bounds.from) next.date_gte = bounds.from;
  else delete next.date_gte;
  next.date_lte = bounds.to;
  return next;
}

/** Custom date bound edit: switches to `custom`, seeding from the active preset. */
export function setCustomDate(
  state: GlobalTransactionFilters,
  field: 'date_gte' | 'date_lte',
  value: string | undefined,
  now = new Date(),
): GlobalTransactionFilters {
  const next: GlobalTransactionFilters = { ...state };
  if (state.datePreset !== 'custom') {
    const bounds = boundsForPreset(state.datePreset, now);
    if (bounds.from) next.date_gte = bounds.from;
    else delete next.date_gte;
    next.date_lte = bounds.to;
  }
  next.datePreset = 'custom';
  if (isNonEmptyString(value)) next[field] = value;
  else delete next[field];
  return next;
}

/** Preset → bounds, or the custom `date_*` pair (open end → today). */
export function boundsFromGlobalFilters(
  state: GlobalTransactionFilters,
  now = new Date(),
): DateRangeBounds {
  if (state.datePreset !== 'custom') {
    return boundsForPreset(state.datePreset, now);
  }
  return {
    from: isNonEmptyString(state.date_gte) ? state.date_gte : null,
    to: isNonEmptyString(state.date_lte) ? state.date_lte : toIsoDate(now),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Custom ranges longer than this use monthly chart buckets. */
const DAILY_BUCKET_MAX_DAYS = 62;

/**
 * Chart granularity preset for report aggregates. Real presets pass through;
 * custom ranges map to a preset with the matching bucket size.
 */
export function granularityPresetForGlobalFilters(
  state: GlobalTransactionFilters,
  bounds: DateRangeBounds,
): DateRangePreset {
  if (state.datePreset !== 'custom') return state.datePreset;
  if (!bounds.from) return 'all';
  const span =
    (Date.parse(`${bounds.to}T00:00:00Z`) -
      Date.parse(`${bounds.from}T00:00:00Z`)) /
    DAY_MS;
  return Number.isFinite(span) && span <= DAILY_BUCKET_MAX_DAYS
    ? 'thisMonth'
    : 'thisYear';
}

/** Report fetch inputs derived from the global filters. */
export type ReportParams = {
  /** Granularity preset (custom ranges mapped by span). */
  preset: DateRangePreset;
  bounds: DateRangeBounds;
  transactionStatus: ReportTransactionStatusFilter;
  /** Stable string for effect deps / request keys. */
  key: string;
};

export function toReportParams(
  state: GlobalTransactionFilters,
  now = new Date(),
): ReportParams {
  const bounds = boundsFromGlobalFilters(state, now);
  const preset = granularityPresetForGlobalFilters(state, bounds);
  return {
    preset,
    bounds,
    transactionStatus: state.status,
    key: `${preset}:${bounds.from ?? ''}:${bounds.to}:${state.status}`,
  };
}

/** Atom → React Admin List `filter` (`preview` → `published`, `all` → no status). */
export function toListFilter(
  state: GlobalTransactionFilters,
  now = new Date(),
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (state.datePreset === 'custom') {
    if (isNonEmptyString(state.date_gte)) filter.date_gte = state.date_gte;
    if (isNonEmptyString(state.date_lte)) filter.date_lte = state.date_lte;
  } else if (state.datePreset !== 'all') {
    const bounds = boundsForPreset(state.datePreset, now);
    if (bounds.from) filter.date_gte = bounds.from;
    filter.date_lte = bounds.to;
  }
  if (state.status === 'preview') filter.status = 'published';
  else if (state.status === 'draft') filter.status = 'draft';
  filter.converted_to_workflow = [...state.converted_to_workflow];
  if (isNonEmptyString(state.createdAt_gte)) {
    filter.createdAt_gte = state.createdAt_gte;
  }
  if (isNonEmptyString(state.createdAt_lte)) {
    filter.createdAt_lte = state.createdAt_lte;
  }
  if (isFiniteNumber(state.amount_gte)) filter.amount_gte = state.amount_gte;
  if (isFiniteNumber(state.amount_lte)) filter.amount_lte = state.amount_lte;
  for (const key of [
    'organization',
    'debit_account',
    'credit_account',
    'description',
    'vendor',
  ] as const) {
    const value = state[key];
    if (isNonEmptyString(value)) filter[key] = value;
  }
  if (state.drilldown) {
    for (const [key, value] of Object.entries(state.drilldown)) {
      if (value != null && value !== '') filter[key] = value;
    }
  }
  return filter;
}

/**
 * Menu override (2A): only status + converted change. Date, amount, org,
 * accounts, description and vendor stay. Drill-down-only keys are dropped.
 */
export function applyMenuOverride(
  state: GlobalTransactionFilters,
  mode: TransactionMenuMode,
): GlobalTransactionFilters {
  const next: GlobalTransactionFilters = { ...state };
  delete next.drilldown;
  if (mode === 'draft') {
    next.status = 'draft';
    next.converted_to_workflow = [...REVIEW_CONVERTED_FILTER];
  } else {
    next.status = 'all';
    next.converted_to_workflow = [...DEFAULT_CONVERTED_FILTER];
  }
  return next;
}

/** Which transaction menu item the current filters match. */
export function menuModeForGlobalFilters(
  state: GlobalTransactionFilters,
): TransactionMenuMode {
  return state.status === 'draft' ? 'draft' : 'all';
}

const KNOWN_LIST_KEYS = new Set([
  'date_gte',
  'date_lte',
  'status',
  'converted_to_workflow',
  'createdAt_gte',
  'createdAt_lte',
  'amount_gte',
  'amount_lte',
  'organization',
  'debit_account',
  'credit_account',
  'description',
  'vendor',
]);

/** Relation keys a drill-down owns: set from the link or cleared. */
const DRILLDOWN_OWNED_KEYS = [
  'organization',
  'debit_account',
  'credit_account',
] as const;

function asNumber(value: unknown): number | undefined {
  if (isFiniteNumber(value)) return value;
  if (isNonEmptyString(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asConvertedList(value: unknown): ConvertedFilterValue[] | undefined {
  const raw = Array.isArray(value) ? value : value != null ? [value] : null;
  if (!raw) return undefined;
  const allowed = new Set<string>(CONVERTED_TO_WORKFLOW_CHOICES);
  return raw.filter(
    (item): item is ConvertedFilterValue =>
      typeof item === 'string' && allowed.has(item),
  );
}

/** URL / RA store may keep `status` as a one-element array. */
function asListStatus(value: unknown): 'preview' | 'draft' | 'all' {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'published') return 'preview';
  if (raw === 'draft') return 'draft';
  return 'all';
}

/**
 * Merge a drill-down list filter (as built by the report drilldown helpers)
 * into the global state:
 *
 * - `date_*` → `datePreset: 'custom'` (absent bound stays open),
 * - `status` → `preview` / `draft` / `all`,
 * - `converted_to_workflow` replaced when present,
 * - organization / accounts set from the link or cleared (the link owns them),
 * - other sidebar fields (amount, createdAt, description, vendor) kept unless
 *   the link sets them,
 * - unknown keys (`currency_type`, leg markers, …) become `drilldown`.
 */
export function mergeDrilldownIntoGlobal(
  state: GlobalTransactionFilters,
  filter: Record<string, unknown>,
): GlobalTransactionFilters {
  const next: GlobalTransactionFilters = { ...state };
  delete next.drilldown;

  if ('date_gte' in filter || 'date_lte' in filter) {
    next.datePreset = 'custom';
    if (isNonEmptyString(filter.date_gte)) next.date_gte = filter.date_gte;
    else delete next.date_gte;
    if (isNonEmptyString(filter.date_lte)) next.date_lte = filter.date_lte;
    else delete next.date_lte;
  } else {
    next.datePreset = 'all';
    delete next.date_gte;
    delete next.date_lte;
  }

  next.status = asListStatus(filter.status);

  const converted = asConvertedList(filter.converted_to_workflow);
  if (converted) next.converted_to_workflow = converted;

  for (const key of DRILLDOWN_OWNED_KEYS) {
    const value = filter[key];
    if (isNonEmptyString(value)) next[key] = value;
    else delete next[key];
  }

  for (const key of [
    'createdAt_gte',
    'createdAt_lte',
    'description',
    'vendor',
  ] as const) {
    const value = filter[key];
    if (isNonEmptyString(value)) next[key] = value;
  }
  for (const key of ['amount_gte', 'amount_lte'] as const) {
    const value = asNumber(filter[key]);
    if (value != null) next[key] = value;
  }

  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filter)) {
    if (KNOWN_LIST_KEYS.has(key)) continue;
    if (value == null || value === '') continue;
    extra[key] = value;
  }
  if (Object.keys(extra).length > 0) next.drilldown = extra;
  return next;
}

/** Order-insensitive JSON for comparing list filters. */
export function stableFilterKey(filter: Record<string, unknown>): string {
  const sorted = Object.keys(filter)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = filter[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}
