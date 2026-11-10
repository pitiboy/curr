import type { DateRangePreset } from '../shared/reportDateRange';

export type { DateRangePreset };

export const PROJECT_BALANCE_FEATURE_ID = 'project-balance';

export type ProjectBalanceStatus = 'loading' | 'success' | 'empty' | 'error';

export type ProjectCurrencyTotals = {
  periodRevenue: number;
  periodCost: number;
  /** periodRevenue − periodCost */
  periodNet: number;
  cumulativeBalance: number;
};

export type ProjectBalanceRow = {
  orgId: string;
  orgName: string;
  byCurrency: Record<string, ProjectCurrencyTotals>;
};

export type ProjectBalanceHistoryPoint = {
  period: string;
  revenue: number;
  cost: number;
};

export type ProjectBalanceReport = {
  /** Distinct currencies with any classified movement through range end. */
  currencies: string[];
  /** Default chart/KPI currency (prefers HUF). */
  historyCurrency: string;
  kpis: ProjectCurrencyTotals;
  byProject: ProjectBalanceRow[];
  historyByCurrency: Record<string, ProjectBalanceHistoryPoint[]>;
  /** Rows with organization + accounts but no cost/revenue match (in loaded set). */
  unclassifiedCount: number;
  /** True when transaction pagination hit the report fetch cap. */
  loadTruncated: boolean;
};
