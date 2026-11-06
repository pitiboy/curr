/**
 * Egg inventory report shapes.
 *
 * Future API (not wired yet): published EGG transactions under the Tyúktartás
 * org tree. Produced = debit 1300 ← credit 4500. Distributed EGG = debit 1001 ←
 * credit 1300 on the parent. Internal vs sale: membership egg.mode (or a
 * companion HUF sale leg). Member name from the 1001 account / member relation.
 * Remaining in a range = produced − distributed.
 */

export type DateRangePreset =
  'all' | 'thisMonth' | 'lastMonth' | 'last7' | 'thisYear';

export type EggInventoryKpis = {
  produced: number;
  distributed: number;
  remaining: number;
  internalTotal: number;
  saleTotal: number;
};

export type EggTimeseriesPoint = {
  /** ISO date (day or month bucket start). */
  period: string;
  /** Alom display name → produced quantity (EGG). */
  byAlom: Record<string, number>;
  /** Distributed in this bucket (aligned with production periods). */
  distributedInternal: number;
  distributedSale: number;
  /** memberId → total EGG (internal+sale) in this bucket — for grouped member bars. */
  byMemberTotal: Record<string, number>;
};

export type EggAlomRow = {
  alomName: string;
  produced: number;
  distributed: number;
  remaining: number;
};

export type EggMemberRow = {
  memberId: string;
  memberName: string;
  /** e.g. "1001 · Peti". */
  accountLabel: string;
  internalQty: number;
  saleQty: number;
  /** Sale revenue in `saleCurrency` (0 when saleQty is 0). */
  saleRevenue: number;
  /** ISO-ish currency code for saleRevenue (mock/API: usually HUF). */
  saleCurrency: string;
};

export type EggInventoryReport = {
  kpis: EggInventoryKpis;
  timeseries: EggTimeseriesPoint[];
  byAlom: EggAlomRow[];
  byMember: EggMemberRow[];
};

export type EggInventoryStatus = 'loading' | 'success' | 'empty' | 'error';
