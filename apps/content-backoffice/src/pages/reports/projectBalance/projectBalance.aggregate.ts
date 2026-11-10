import type { AccountCodePatterns } from '../../../data/accountCodes';
import {
  boundsForPreset,
  periodKeyForPreset,
  periodsInRange,
  type DateRangeBounds,
  type DateRangePreset,
} from '../shared/reportDateRange';

import { classifyLedgerMovement } from './projectBalance.classify';
import type {
  ProjectBalanceHistoryPoint,
  ProjectBalanceReport,
  ProjectBalanceRow,
  ProjectCurrencyTotals,
} from './types';

export type ProjectBalanceTx = {
  date: string;
  amount: number;
  currencyCode: string;
  orgId: string;
  orgName: string;
  kind: 'cost' | 'revenue';
};

type OrgAcc = {
  orgId: string;
  orgName: string;
  byCurrency: Map<
    string,
    {
      periodRevenue: number;
      periodCost: number;
      cumulativeRevenue: number;
      cumulativeCost: number;
    }
  >;
};

function emptyTotals(): ProjectCurrencyTotals {
  return {
    periodRevenue: 0,
    periodCost: 0,
    periodNet: 0,
    cumulativeBalance: 0,
  };
}

function totalsFromParts(
  periodRevenue: number,
  periodCost: number,
  cumulativeRevenue: number,
  cumulativeCost: number,
): ProjectCurrencyTotals {
  return {
    periodRevenue,
    periodCost,
    periodNet: periodRevenue - periodCost,
    cumulativeBalance: cumulativeRevenue - cumulativeCost,
  };
}

function dateInPeriod(isoDate: string, bounds: DateRangeBounds): boolean {
  const day = isoDate.slice(0, 10);
  if (day > bounds.to) return false;
  if (bounds.from && day < bounds.from) return false;
  return true;
}

function ensureOrg(map: Map<string, OrgAcc>, tx: ProjectBalanceTx): OrgAcc {
  let row = map.get(tx.orgId);
  if (!row) {
    row = {
      orgId: tx.orgId,
      orgName: tx.orgName,
      byCurrency: new Map(),
    };
    map.set(tx.orgId, row);
  }
  return row;
}

function ensureCurrency(
  org: OrgAcc,
  currency: string,
): {
  periodRevenue: number;
  periodCost: number;
  cumulativeRevenue: number;
  cumulativeCost: number;
} {
  let row = org.byCurrency.get(currency);
  if (!row) {
    row = {
      periodRevenue: 0,
      periodCost: 0,
      cumulativeRevenue: 0,
      cumulativeCost: 0,
    };
    org.byCurrency.set(currency, row);
  }
  return row;
}

/** Prefer HUF when present; otherwise the currency with the largest period volume. */
export function pickProjectBalanceCurrency(
  orgs: readonly ProjectBalanceRow[],
): string {
  const totals = new Map<string, number>();
  for (const org of orgs) {
    for (const [currency, parts] of Object.entries(org.byCurrency)) {
      const volume =
        parts.periodRevenue +
        parts.periodCost +
        Math.abs(parts.cumulativeBalance);
      totals.set(currency, (totals.get(currency) ?? 0) + volume);
    }
  }
  if ((totals.get('HUF') ?? 0) > 0) return 'HUF';
  let best = 'HUF';
  let bestAmt = -1;
  for (const [currency, amount] of totals) {
    if (amount > bestAmt) {
      best = currency;
      bestAmt = amount;
    }
  }
  return best;
}

export function mapTxToProjectBalance(
  row: {
    date?: string | null;
    amount?: string | number | null;
    currency_type?: { code?: string | null } | null;
    organization?: { documentId?: string; name?: string | null } | null;
    debit_account?: { code?: string | null } | null;
    credit_account?: { code?: string | null } | null;
  },
  patterns: AccountCodePatterns,
): ProjectBalanceTx | null {
  if (!row.date) return null;
  const orgId = row.organization?.documentId ?? '';
  const orgName = row.organization?.name?.trim() ?? '';
  if (!orgId || !orgName) return null;
  const debitCode = String(row.debit_account?.code ?? '').trim();
  const creditCode = String(row.credit_account?.code ?? '').trim();
  const currencyCode = String(row.currency_type?.code ?? '').trim();
  if (!debitCode || !creditCode || !currencyCode) return null;
  const kind = classifyLedgerMovement(debitCode, creditCode, patterns);
  if (!kind) return null;
  const n =
    typeof row.amount === 'number' ? row.amount : Number(row.amount ?? 0);
  if (!Number.isFinite(n) || n === 0) return null;
  return {
    date: row.date.slice(0, 10),
    amount: n,
    currencyCode,
    orgId,
    orgName,
    kind,
  };
}

/**
 * Aggregate classified project ledger lines into KPIs, per-project rows, and
 * a time series for the active currency.
 */
export function aggregateProjectBalanceReport(
  txs: readonly ProjectBalanceTx[],
  preset: DateRangePreset,
  options: {
    organizationId?: string | null;
    unclassifiedCount?: number;
    loadTruncated?: boolean;
  } = {},
): ProjectBalanceReport | null {
  const bounds = boundsForPreset(preset);
  const orgFilter = options.organizationId?.trim() || null;

  const filtered = orgFilter ? txs.filter((tx) => tx.orgId === orgFilter) : txs;

  if (filtered.length === 0) return null;

  const orgMap = new Map<string, OrgAcc>();
  const historyByCurrencyMap = new Map<
    string,
    Map<string, { revenue: number; cost: number }>
  >();

  for (const tx of filtered) {
    if (tx.date > bounds.to) continue;
    const org = ensureOrg(orgMap, tx);
    const bucket = ensureCurrency(org, tx.currencyCode);
    const inPeriod = dateInPeriod(tx.date, bounds);

    if (tx.kind === 'revenue') {
      bucket.cumulativeRevenue += tx.amount;
      if (inPeriod) bucket.periodRevenue += tx.amount;
    } else {
      bucket.cumulativeCost += tx.amount;
      if (inPeriod) bucket.periodCost += tx.amount;
    }
  }

  const byProject: ProjectBalanceRow[] = [];
  const currencySet = new Set<string>();

  for (const org of orgMap.values()) {
    const byCurrency: ProjectBalanceRow['byCurrency'] = {};
    let visible = false;
    for (const [currency, parts] of org.byCurrency) {
      currencySet.add(currency);
      const totals = totalsFromParts(
        parts.periodRevenue,
        parts.periodCost,
        parts.cumulativeRevenue,
        parts.cumulativeCost,
      );
      if (
        totals.periodRevenue !== 0 ||
        totals.periodCost !== 0 ||
        totals.cumulativeBalance !== 0
      ) {
        visible = true;
      }
      byCurrency[currency] = totals;
    }
    if (visible) {
      byProject.push({
        orgId: org.orgId,
        orgName: org.orgName,
        byCurrency,
      });
    }
  }

  byProject.sort((a, b) =>
    a.orgName.localeCompare(b.orgName, 'hu', { sensitivity: 'base' }),
  );

  if (byProject.length === 0) return null;

  const historyCurrency = pickProjectBalanceCurrency(byProject);
  const currencies = [...currencySet].sort((a, b) => a.localeCompare(b));

  const fallbackFromByCurrency = new Map<string, string>();
  for (const currency of currencies) {
    fallbackFromByCurrency.set(currency, bounds.from ?? bounds.to);
  }
  for (const tx of filtered) {
    const cursor = fallbackFromByCurrency.get(tx.currencyCode);
    if (cursor && tx.date < cursor) {
      fallbackFromByCurrency.set(tx.currencyCode, tx.date);
    }
  }

  for (const tx of filtered) {
    if (!dateInPeriod(tx.date, bounds)) continue;
    const key = periodKeyForPreset(tx.date, preset);
    let currencyMap = historyByCurrencyMap.get(tx.currencyCode);
    if (!currencyMap) {
      currencyMap = new Map();
      historyByCurrencyMap.set(tx.currencyCode, currencyMap);
    }
    let point = currencyMap.get(key);
    if (!point) {
      point = { revenue: 0, cost: 0 };
      currencyMap.set(key, point);
    }
    if (tx.kind === 'revenue') point.revenue += tx.amount;
    else point.cost += tx.amount;
  }

  const historyByCurrency: Record<string, ProjectBalanceHistoryPoint[]> = {};
  for (const currency of currencies) {
    const fallbackFrom =
      fallbackFromByCurrency.get(currency) ?? bounds.from ?? bounds.to;
    const periods = periodsInRange(preset, bounds, fallbackFrom);
    const currencyMap = historyByCurrencyMap.get(currency);
    historyByCurrency[currency] = periods.map((period) => {
      const amounts = currencyMap?.get(period) ?? { revenue: 0, cost: 0 };
      return {
        period,
        revenue: amounts.revenue,
        cost: amounts.cost,
      };
    });
  }

  const kpis = emptyTotals();
  for (const row of byProject) {
    const parts = row.byCurrency[historyCurrency];
    if (!parts) continue;
    kpis.periodRevenue += parts.periodRevenue;
    kpis.periodCost += parts.periodCost;
    kpis.periodNet += parts.periodNet;
    kpis.cumulativeBalance += parts.cumulativeBalance;
  }

  return {
    currencies,
    historyCurrency,
    kpis,
    byProject,
    historyByCurrency,
    unclassifiedCount: options.unclassifiedCount ?? 0,
    loadTruncated: options.loadTruncated ?? false,
  };
}
