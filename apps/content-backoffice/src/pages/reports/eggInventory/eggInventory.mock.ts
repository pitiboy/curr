import {
  DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE,
  EGG_PRODUCTION_CREDIT_ACCOUNT_CODE,
  EGG_PRODUCTION_DEBIT_ACCOUNT_CODE,
} from '../../../workflows/bulk-quantity/eggDailyEntry.constants';

import type {
  DateRangePreset,
  EggAlomRow,
  EggInventoryKpis,
  EggInventoryReport,
  EggMemberRow,
  EggTimeseriesPoint,
} from './types';

/** Ledger codes used when a real aggregator is wired. */
export const EGG_REPORT_ACCOUNT_CODES = {
  inventory: EGG_PRODUCTION_DEBIT_ACCOUNT_CODE,
  productionCredit: EGG_PRODUCTION_CREDIT_ACCOUNT_CODE,
  memberPrivate: DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE,
} as const;

const ALOMS = ['2024 alom', '2025 alom', '2026 alom'] as const;

export function memberTotal(row: EggMemberRow): number {
  return row.internalQty + row.saleQty;
}

export function producedInPeriod(point: EggTimeseriesPoint): number {
  return Object.values(point.byAlom).reduce((sum, n) => sum + n, 0);
}

export function buildKpis(
  produced: number,
  internalTotal: number,
  saleTotal: number,
): EggInventoryKpis {
  const distributed = internalTotal + saleTotal;
  return {
    produced,
    distributed,
    remaining: produced - distributed,
    internalTotal,
    saleTotal,
  };
}

export function sortMembersByTotal(rows: EggMemberRow[]): EggMemberRow[] {
  return [...rows]
    .filter((row) => memberTotal(row) > 0)
    .sort((a, b) => memberTotal(b) - memberTotal(a));
}

function assertConsistent(report: EggInventoryReport): EggInventoryReport {
  const { kpis, byMember, byAlom, timeseries } = report;
  if (kpis.internalTotal + kpis.saleTotal !== kpis.distributed) {
    throw new Error('egg mock: internal+sale !== distributed');
  }
  if (kpis.produced - kpis.distributed !== kpis.remaining) {
    throw new Error('egg mock: produced-distributed !== remaining');
  }
  const memberInternal = byMember.reduce((s, r) => s + r.internalQty, 0);
  const memberSale = byMember.reduce((s, r) => s + r.saleQty, 0);
  if (memberInternal !== kpis.internalTotal || memberSale !== kpis.saleTotal) {
    throw new Error('egg mock: byMember totals mismatch KPIs');
  }
  const alomProduced = byAlom.reduce((s, r) => s + r.produced, 0);
  if (alomProduced !== kpis.produced) {
    throw new Error('egg mock: byAlom produced mismatch KPI');
  }
  const seriesProduced = timeseries.reduce(
    (s, p) => s + producedInPeriod(p),
    0,
  );
  if (seriesProduced !== kpis.produced) {
    throw new Error('egg mock: timeseries produced mismatch KPI');
  }
  const seriesInternal = timeseries.reduce(
    (s, p) => s + p.distributedInternal,
    0,
  );
  const seriesSale = timeseries.reduce((s, p) => s + p.distributedSale, 0);
  if (seriesInternal !== kpis.internalTotal || seriesSale !== kpis.saleTotal) {
    throw new Error('egg mock: timeseries distribution mismatch KPI');
  }
  return report;
}

function members(
  rows: Array<Omit<EggMemberRow, 'accountLabel'> & { accountLabel?: string }>,
): EggMemberRow[] {
  return sortMembersByTotal(
    rows.map((row) => ({
      ...row,
      accountLabel:
        row.accountLabel ??
        `${DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE} · ${row.memberName}`,
    })),
  );
}

function alomRows(
  produced: Record<(typeof ALOMS)[number], number>,
  distributedShare: number,
): EggAlomRow[] {
  const totalProduced = ALOMS.reduce((s, name) => s + produced[name], 0);
  return ALOMS.map((alomName) => {
    const p = produced[alomName];
    const d =
      totalProduced === 0
        ? 0
        : Math.round((p / totalProduced) * distributedShare);
    return { alomName, produced: p, distributed: d, remaining: p - d };
  });
}

function series(
  points: Array<{
    period: string;
    values: number[];
    internal: number;
    sale: number;
  }>,
): EggTimeseriesPoint[] {
  return points.map(({ period, values, internal, sale }) => ({
    period,
    byAlom: Object.fromEntries(ALOMS.map((name, i) => [name, values[i] ?? 0])),
    distributedInternal: internal,
    distributedSale: sale,
  }));
}

const REPORTS: Record<DateRangePreset, EggInventoryReport | null> = {
  all: assertConsistent({
    kpis: buildKpis(1840, 620, 980),
    timeseries: series([
      { period: '2024-01', values: [160, 0, 0], internal: 54, sale: 85 },
      { period: '2024-06', values: [140, 0, 0], internal: 47, sale: 75 },
      { period: '2025-01', values: [60, 120, 0], internal: 61, sale: 96 },
      { period: '2025-06', values: [40, 180, 0], internal: 74, sale: 117 },
      { period: '2026-01', values: [20, 100, 140], internal: 88, sale: 139 },
      { period: '2026-03', values: [0, 90, 170], internal: 88, sale: 139 },
      { period: '2026-06', values: [0, 70, 220], internal: 98, sale: 155 },
      { period: '2026-10', values: [0, 50, 280], internal: 110, sale: 174 },
    ]),
    byAlom: alomRows(
      { '2024 alom': 420, '2025 alom': 610, '2026 alom': 810 },
      620 + 980,
    ),
    byMember: members([
      { memberId: 'm-peti', memberName: 'Peti', internalQty: 280, saleQty: 40 },
      { memberId: 'm-laci', memberName: 'Laci', internalQty: 210, saleQty: 0 },
      { memberId: 'm-anna', memberName: 'Anna', internalQty: 0, saleQty: 360 },
      {
        memberId: 'm-gabor',
        memberName: 'Gábor',
        internalQty: 90,
        saleQty: 220,
      },
      { memberId: 'm-eva', memberName: 'Éva', internalQty: 40, saleQty: 180 },
      {
        memberId: 'm-norbi',
        memberName: 'Norbi',
        internalQty: 0,
        saleQty: 180,
      },
    ]),
  }),

  thisYear: assertConsistent({
    kpis: buildKpis(720, 180, 410),
    timeseries: series([
      { period: '2026-01', values: [16, 50, 70], internal: 40, sale: 50 },
      { period: '2026-03', values: [12, 45, 80], internal: 35, sale: 60 },
      { period: '2026-05', values: [8, 40, 90], internal: 30, sale: 70 },
      { period: '2026-07', values: [4, 35, 80], internal: 30, sale: 75 },
      { period: '2026-09', values: [0, 30, 80], internal: 25, sale: 80 },
      { period: '2026-11', values: [0, 20, 60], internal: 20, sale: 75 },
    ]),
    byAlom: alomRows(
      { '2024 alom': 40, '2025 alom': 220, '2026 alom': 460 },
      180 + 410,
    ),
    byMember: members([
      { memberId: 'm-peti', memberName: 'Peti', internalQty: 90, saleQty: 20 },
      { memberId: 'm-laci', memberName: 'Laci', internalQty: 70, saleQty: 0 },
      { memberId: 'm-anna', memberName: 'Anna', internalQty: 0, saleQty: 160 },
      {
        memberId: 'm-gabor',
        memberName: 'Gábor',
        internalQty: 20,
        saleQty: 120,
      },
      { memberId: 'm-eva', memberName: 'Éva', internalQty: 0, saleQty: 70 },
      { memberId: 'm-norbi', memberName: 'Norbi', internalQty: 0, saleQty: 40 },
    ]),
  }),

  thisMonth: assertConsistent({
    kpis: buildKpis(96, 28, 52),
    timeseries: series([
      { period: '2026-11-01', values: [0, 4, 10], internal: 4, sale: 6 },
      { period: '2026-11-05', values: [0, 3, 12], internal: 5, sale: 7 },
      { period: '2026-11-10', values: [0, 3, 12], internal: 4, sale: 8 },
      { period: '2026-11-15', values: [0, 2, 12], internal: 4, sale: 8 },
      { period: '2026-11-20', values: [0, 2, 12], internal: 4, sale: 7 },
      { period: '2026-11-25', values: [0, 2, 10], internal: 4, sale: 8 },
      { period: '2026-11-30', values: [0, 2, 10], internal: 3, sale: 8 },
    ]),
    byAlom: alomRows(
      { '2024 alom': 0, '2025 alom': 18, '2026 alom': 78 },
      28 + 52,
    ),
    byMember: members([
      { memberId: 'm-peti', memberName: 'Peti', internalQty: 12, saleQty: 0 },
      { memberId: 'm-laci', memberName: 'Laci', internalQty: 10, saleQty: 0 },
      { memberId: 'm-anna', memberName: 'Anna', internalQty: 0, saleQty: 24 },
      {
        memberId: 'm-gabor',
        memberName: 'Gábor',
        internalQty: 6,
        saleQty: 16,
      },
      { memberId: 'm-eva', memberName: 'Éva', internalQty: 0, saleQty: 12 },
    ]),
  }),

  lastMonth: assertConsistent({
    kpis: buildKpis(110, 34, 60),
    timeseries: series([
      { period: '2026-10-01', values: [0, 6, 16], internal: 8, sale: 10 },
      { period: '2026-10-08', values: [0, 6, 18], internal: 8, sale: 12 },
      { period: '2026-10-15', values: [0, 5, 18], internal: 7, sale: 13 },
      { period: '2026-10-22', values: [0, 4, 18], internal: 6, sale: 13 },
      { period: '2026-10-29', values: [0, 3, 16], internal: 5, sale: 12 },
    ]),
    byAlom: alomRows(
      { '2024 alom': 0, '2025 alom': 24, '2026 alom': 86 },
      34 + 60,
    ),
    byMember: members([
      { memberId: 'm-peti', memberName: 'Peti', internalQty: 14, saleQty: 4 },
      { memberId: 'm-laci', memberName: 'Laci', internalQty: 12, saleQty: 0 },
      { memberId: 'm-anna', memberName: 'Anna', internalQty: 0, saleQty: 28 },
      {
        memberId: 'm-gabor',
        memberName: 'Gábor',
        internalQty: 8,
        saleQty: 18,
      },
      { memberId: 'm-norbi', memberName: 'Norbi', internalQty: 0, saleQty: 10 },
    ]),
  }),

  /** Quiet week — empty state for the UI. */
  last7: null,
};

/** Synchronous mock lookup. `null` means empty for the preset. */
export function getEggInventoryReport(
  preset: DateRangePreset,
): EggInventoryReport | null {
  return REPORTS[preset];
}

const MOCK_DELAY_MS = 280;

/**
 * Async mock fetch. Rejects only when `forceError` is true (tests / debug).
 */
export function fetchEggInventoryReport(
  preset: DateRangePreset,
  options: { forceError?: boolean; delayMs?: number } = {},
): Promise<EggInventoryReport | null> {
  const delayMs = options.delayMs ?? MOCK_DELAY_MS;
  return new Promise((resolve, reject) => {
    globalThis.setTimeout(() => {
      if (options.forceError) {
        reject(new Error('egg inventory mock failure'));
        return;
      }
      resolve(getEggInventoryReport(preset));
    }, delayMs);
  });
}

export const EGG_REPORT_ALOM_NAMES = [...ALOMS];
