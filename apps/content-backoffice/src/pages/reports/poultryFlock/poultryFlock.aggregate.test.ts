import { describe, expect, it } from 'vitest';

import {
  aggregatePoultryFlockReport,
  classifyFlockTx,
  enumeratePeriods,
  type FlockReportCatalog,
  type FlockReportTx,
} from './poultryFlock.aggregate';

const catalog: FlockReportCatalog = {
  henHouseNames: new Map([
    ['org-2025', '2025 alom'],
    ['org-2026', '2026 alom'],
  ]),
};

function tx(
  partial: Partial<FlockReportTx> & Pick<FlockReportTx, 'date'>,
): FlockReportTx {
  return {
    amount: 0,
    currencyCode: 'HEN',
    debitCode: '1300',
    creditCode: '2000',
    orgId: 'org-2026',
    orgName: '',
    ...partial,
  };
}

const bounds = { from: '2026-11-01', to: '2026-11-05' };

describe('classifyFlockTx', () => {
  it('classifies purchase, mortality, slaughter and other outflows', () => {
    expect(classifyFlockTx(tx({ date: 'd', amount: 5 }))).toEqual({
      delta: 5,
      kind: 'added',
    });
    expect(
      classifyFlockTx(
        tx({ date: 'd', amount: 2, debitCode: '5810', creditCode: '1300' }),
      ),
    ).toEqual({ delta: -2, kind: 'died' });
    expect(
      classifyFlockTx(
        tx({ date: 'd', amount: 1, debitCode: '1001', creditCode: '1300' }),
      ),
    ).toEqual({ delta: -1, kind: 'slaughtered' });
    expect(
      classifyFlockTx(
        tx({ date: 'd', amount: 1, debitCode: '4000', creditCode: '1300' }),
      ),
    ).toEqual({ delta: -1, kind: 'otherOut' });
    expect(
      classifyFlockTx(
        tx({ date: 'd', amount: 1, debitCode: '1300', creditCode: '1300' }),
      ),
    ).toBeNull();
  });
});

describe('enumeratePeriods', () => {
  it('builds continuous day and month buckets', () => {
    expect(enumeratePeriods('2026-02-27', '2026-03-01', 'day')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
    expect(enumeratePeriods('2025-11-15', '2026-02-01', 'month')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});

describe('aggregatePoultryFlockReport', () => {
  it('returns null without flock movements', () => {
    expect(
      aggregatePoultryFlockReport([], catalog, 'thisMonth', bounds),
    ).toBeNull();
    expect(
      aggregatePoultryFlockReport(
        [tx({ date: '2026-11-02', amount: 10, currencyCode: 'EGG' })],
        catalog,
        'thisMonth',
        bounds,
      ),
    ).toBeNull();
  });

  it('tracks opening, movements, closing and the running headcount', () => {
    const report = aggregatePoultryFlockReport(
      [
        // Before range → opening.
        tx({ date: '2026-10-01', amount: 20, orgId: 'org-2025' }),
        tx({
          date: '2026-10-01',
          amount: 2,
          currencyCode: 'ROOSTER',
          orgId: 'org-2025',
        }),
        // In range.
        tx({ date: '2026-11-02', amount: 30 }),
        tx({
          date: '2026-11-03',
          amount: 1,
          debitCode: '5810',
          creditCode: '1300',
          orgId: 'org-2025',
        }),
        tx({
          date: '2026-11-04',
          amount: 1,
          currencyCode: 'ROOSTER',
          debitCode: '1001',
          creditCode: '1300',
          orgId: 'org-2025',
        }),
        // After range → ignored.
        tx({ date: '2026-11-09', amount: 99 }),
      ],
      catalog,
      'thisMonth',
      bounds,
    );

    expect(report).not.toBeNull();
    const { kpis, byAlom, timeseries, alomNames } = report!;
    expect(kpis.opening).toEqual({ hen: 20, rooster: 2, total: 22 });
    expect(kpis.added).toEqual({ hen: 30, rooster: 0, total: 30 });
    expect(kpis.died).toEqual({ hen: 1, rooster: 0, total: 1 });
    expect(kpis.slaughtered).toEqual({ hen: 0, rooster: 1, total: 1 });
    expect(kpis.closing).toEqual({ hen: 49, rooster: 1, total: 50 });

    expect(alomNames).toEqual(['2025 alom', '2026 alom']);
    expect(byAlom[0]).toMatchObject({
      alomName: '2025 alom',
      opening: 22,
      died: 1,
      slaughtered: 1,
      closing: 20,
      closingHen: 19,
      closingRooster: 1,
    });
    expect(byAlom[0]?.mortalityRate).toBeCloseTo(1 / 22);
    expect(byAlom[1]).toMatchObject({ opening: 0, added: 30, closing: 30 });

    expect(timeseries.map((p) => p.period)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
    ]);
    expect(timeseries.map((p) => p.headcount.total)).toEqual([
      22, 52, 51, 50, 50,
    ]);
    expect(timeseries[1]?.headcountByAlom).toEqual({
      '2025 alom': 22,
      '2026 alom': 30,
    });
    expect(timeseries[2]?.died).toBe(1);
    expect(timeseries[3]?.slaughtered).toBe(1);
  });

  it('starts the "all" range at the first movement, bucketed by month', () => {
    const report = aggregatePoultryFlockReport(
      [
        tx({ date: '2026-09-11', amount: 10 }),
        tx({
          date: '2026-11-02',
          amount: 3,
          debitCode: '5810',
          creditCode: '1300',
        }),
      ],
      catalog,
      'all',
      { from: null, to: '2026-11-08' },
    );
    expect(
      report?.timeseries.map((p) => [p.period, p.headcount.total]),
    ).toEqual([
      ['2026-09', 10],
      ['2026-10', 10],
      ['2026-11', 7],
    ]);
    expect(report?.kpis.opening.total).toBe(0);
  });
});
