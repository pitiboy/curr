import type {
  ProjectBalanceReport,
  ProjectBalanceRow,
  ProjectCurrencyTotals,
} from './types';

function emptyTotals(): ProjectCurrencyTotals {
  return {
    periodRevenue: 0,
    periodCost: 0,
    periodNet: 0,
    cumulativeBalance: 0,
  };
}

export function kpisForCurrency(
  report: ProjectBalanceReport,
  currency: string,
): ProjectCurrencyTotals {
  const kpis = emptyTotals();
  for (const row of report.byProject) {
    const parts = row.byCurrency[currency];
    if (!parts) continue;
    kpis.periodRevenue += parts.periodRevenue;
    kpis.periodCost += parts.periodCost;
    kpis.periodNet += parts.periodNet;
    kpis.cumulativeBalance += parts.cumulativeBalance;
  }
  return kpis;
}

export function projectTotalsForCurrency(
  row: ProjectBalanceRow,
  currency: string,
): ProjectCurrencyTotals | null {
  return row.byCurrency[currency] ?? null;
}
