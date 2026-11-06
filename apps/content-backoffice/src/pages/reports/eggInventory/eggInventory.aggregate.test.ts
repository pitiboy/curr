import { describe, expect, it } from 'vitest';

import {
  aggregateEggInventoryReport,
  type EggReportCatalog,
  type EggReportTx,
} from './eggInventory.aggregate';

const catalog: EggReportCatalog = {
  henHouseIds: new Set(['org-2026']),
  henHouseNames: new Map([['org-2026', '2026 alom']]),
  members: [
    {
      memberId: 'm-peti',
      memberName: 'Peti',
      privateAccountId: 'acc-peti',
      privateAccountCode: '1001',
    },
    {
      memberId: 'm-anna',
      memberName: 'Anna',
      privateAccountId: 'acc-anna',
      privateAccountCode: '1001',
    },
  ],
  saleCurrency: 'HUF',
};

function tx(partial: Partial<EggReportTx> & Pick<EggReportTx, 'date'>): EggReportTx {
  return {
    amount: 0,
    currencyCode: 'EGG',
    debitCode: '',
    creditCode: '',
    debitAccountId: '',
    creditAccountId: '',
    orgId: '',
    orgName: '',
    ...partial,
  };
}

describe('aggregateEggInventoryReport', () => {
  it('returns null when there is no activity', () => {
    expect(aggregateEggInventoryReport([], catalog, 'thisMonth')).toBeNull();
  });

  it('sums production by hen house and splits internal vs sale', () => {
    const rows: EggReportTx[] = [
      tx({
        date: '2026-11-10',
        amount: 30,
        debitCode: '1300',
        creditCode: '4500',
        orgId: 'org-2026',
        orgName: '2026 alom',
      }),
      tx({
        date: '2026-11-10',
        amount: 10,
        debitCode: '1001',
        creditCode: '1300',
        debitAccountId: 'acc-peti',
        orgId: 'org-parent',
        orgName: 'Tyúktartás',
      }),
      tx({
        date: '2026-11-10',
        amount: 12,
        debitCode: '1001',
        creditCode: '1300',
        debitAccountId: 'acc-anna',
        orgId: 'org-parent',
        orgName: 'Tyúktartás',
      }),
      tx({
        date: '2026-11-10',
        amount: 1200,
        currencyCode: 'HUF',
        debitCode: '1000',
        creditCode: '1001',
        creditAccountId: 'acc-anna',
        debitAccountId: 'acc-cash',
      }),
    ];

    const report = aggregateEggInventoryReport(rows, catalog, 'thisMonth');
    expect(report).not.toBeNull();
    if (!report) return;

    expect(report.kpis).toEqual({
      produced: 30,
      distributed: 22,
      remaining: 8,
      internalTotal: 10,
      saleTotal: 12,
    });
    expect(report.byAlom).toEqual([
      {
        alomName: '2026 alom',
        produced: 30,
        distributed: 22,
        remaining: 8,
      },
    ]);
    expect(report.byMember.map((m) => m.memberName)).toEqual(['Anna', 'Peti']);
    const anna = report.byMember.find((m) => m.memberId === 'm-anna');
    expect(anna).toMatchObject({
      saleQty: 12,
      internalQty: 0,
      saleRevenue: 1200,
      saleCurrency: 'HUF',
    });
    const peti = report.byMember.find((m) => m.memberId === 'm-peti');
    expect(peti).toMatchObject({
      saleQty: 0,
      internalQty: 10,
      saleRevenue: 0,
    });
    expect(report.timeseries[0]?.byMemberTotal).toEqual({
      'm-peti': 10,
      'm-anna': 12,
    });
  });

  it('ignores production outside hen houses (pool parent-in)', () => {
    const rows: EggReportTx[] = [
      tx({
        date: '2026-11-01',
        amount: 40,
        debitCode: '1300',
        creditCode: '4500',
        orgId: 'org-parent',
        orgName: 'Tyúktartás',
      }),
      tx({
        date: '2026-11-01',
        amount: 40,
        debitCode: '1300',
        creditCode: '4500',
        orgId: 'org-2026',
        orgName: '2026 alom',
      }),
    ];
    const report = aggregateEggInventoryReport(rows, catalog, 'thisMonth');
    expect(report?.kpis.produced).toBe(40);
  });

  it('counts saját-named distributions without membership map', () => {
    const rows: EggReportTx[] = [
      tx({
        date: '2026-11-01',
        amount: 10,
        debitCode: '1001',
        creditCode: '1300',
        debitAccountId: 'acc-peti',
        debitAccountName: 'peti - saját számla',
      }),
      tx({
        date: '2026-11-01',
        amount: 5,
        debitCode: '4500',
        creditCode: '1300',
        debitAccountId: 'acc-4500',
      }),
    ];
    const emptyMembers: EggReportCatalog = { ...catalog, members: [] };
    const report = aggregateEggInventoryReport(rows, emptyMembers, 'thisMonth');
    expect(report?.kpis).toEqual({
      produced: 0,
      distributed: 10,
      remaining: -10,
      internalTotal: 10,
      saleTotal: 0,
    });
    expect(report?.byMember[0]).toMatchObject({
      memberName: 'peti',
      internalQty: 10,
    });
  });
});
