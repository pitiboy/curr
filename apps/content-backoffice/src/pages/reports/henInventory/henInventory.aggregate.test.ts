import { describe, expect, it } from 'vitest';

import {
  aggregateHenInventoryReport,
  type HenReportCatalog,
  type HenReportTx,
} from './henInventory.aggregate';

const catalog: HenReportCatalog = {
  henHouseIds: new Set(['org-2025', 'org-2026']),
  henHouseNames: new Map([
    ['org-2025', '2025 alom'],
    ['org-2026', '2026 alom'],
  ]),
  poultryParentOrgId: null,
  members: [
    {
      memberId: 'm-peti',
      memberName: 'Peti',
      privateAccountId: 'acc-peti',
      privateAccountCode: '1001',
    },
  ],
};

const now = new Date(2026, 10, 15);

function tx(
  partial: Partial<HenReportTx> & Pick<HenReportTx, 'date'>,
): HenReportTx {
  return {
    amount: 1,
    currencyCode: 'HEN',
    debitCode: '1300',
    creditCode: '2000',
    debitAccountId: 'a1',
    orgId: 'org-2026',
    orgName: '2026 alom',
    ...partial,
  };
}

describe('aggregateHenInventoryReport', () => {
  it('returns null when there is no activity', () => {
    expect(
      aggregateHenInventoryReport([], catalog, 'thisMonth', now),
    ).toBeNull();
  });

  it('tracks stock per alom and splits slaughter vs transfer', () => {
    const rows: HenReportTx[] = [
      tx({
        date: '2026-11-01',
        amount: 10,
        debitCode: '1300',
        creditCode: '2000',
      }),
      tx({
        date: '2026-11-03',
        amount: 3,
        debitCode: '1001',
        creditCode: '1300',
        debitAccountId: 'acc-peti',
        description: 'Levágás (tojó) – heti',
      }),
      tx({
        date: '2026-11-05',
        amount: 2,
        debitCode: '1001',
        creditCode: '1300',
        debitAccountId: 'acc-peti',
        description: 'Tyúk átadás Petinek',
      }),
    ];

    const report = aggregateHenInventoryReport(rows, catalog, 'thisMonth', now);
    expect(report).not.toBeNull();
    expect(report!.kpis.totalStock).toBe(5);
    expect(report!.kpis.slaughterInPeriod).toBe(3);
    expect(report!.kpis.transferInPeriod).toBe(2);
    expect(report!.byMember[0]?.slaughterQty).toBe(3);
    expect(report!.byMember[0]?.transferQty).toBe(2);

    const lastPoint = report!.stockTimeseries.at(-1);
    expect(lastPoint?.byAlom['2026 alom']).toBe(5);
    expect(report!.outflowTimeseries.length).toBe(
      report!.stockTimeseries.length,
    );
  });

  it('uses monthly buckets for all-time presets', () => {
    const rows: HenReportTx[] = [
      tx({
        date: '2026-10-15',
        amount: 5,
        orgId: 'org-2025',
        orgName: '2025 alom',
      }),
      tx({
        date: '2026-11-10',
        amount: 2,
        debitCode: '1001',
        creditCode: '1300',
        debitAccountId: 'acc-peti',
        description: 'Levágás (tojó)',
      }),
    ];
    const report = aggregateHenInventoryReport(rows, catalog, 'all', now);
    expect(report!.outflowTimeseries.some((p) => p.period === '2026-11')).toBe(
      true,
    );
    expect(report!.stockTimeseries.length).toBeGreaterThan(1);
  });

  it('includes CHICK and ROOSTER stock like HEN', () => {
    const rows: HenReportTx[] = [
      tx({
        date: '2026-03-09',
        amount: 60,
        currencyCode: 'CHICK',
        debitCode: '1300',
        creditCode: '2000',
      }),
      tx({
        date: '2026-11-01',
        amount: 5,
        currencyCode: 'ROOSTER',
        debitCode: '1300',
        creditCode: '2000',
      }),
    ];
    const report = aggregateHenInventoryReport(rows, catalog, 'all', now);
    expect(report!.kpis.totalStock).toBe(65);
    expect(report!.kpis.intakeInPeriod).toBe(65);
    expect(
      report!.byAlom.find((r) => r.alomName === '2026 alom')?.stockEnd,
    ).toBe(65);
  });

  it('counts mortality in kpis', () => {
    const rows: HenReportTx[] = [
      tx({ date: '2026-11-01', amount: 8 }),
      tx({
        date: '2026-11-02',
        amount: 1,
        debitCode: '5810',
        creditCode: '1300',
      }),
    ];
    const report = aggregateHenInventoryReport(rows, catalog, 'thisMonth', now);
    expect(report!.kpis.mortalityInPeriod).toBe(1);
    expect(report!.kpis.totalStock).toBe(7);
  });
});
