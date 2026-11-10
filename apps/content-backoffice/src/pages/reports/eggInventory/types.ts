/**
 * Egg inventory report shapes.
 *
 * Source: published Content API transactions. Produced = EGG debit 1300 ←
 * credit 4500 on Tyúktartás hen-house orgs. Distributed EGG = debit member
 * private (1001) ← credit 1300. Sale vs internal: companion HUF cash leg
 * (1000 ← member 1001) on the same day. Remaining = produced − distributed.
 */

import type { DateRangePreset } from '../shared/reportDateRange';

export type { DateRangePreset };

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
