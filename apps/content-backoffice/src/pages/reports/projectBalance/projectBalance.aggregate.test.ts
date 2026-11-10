import { describe, expect, it } from 'vitest';

import {
  aggregateProjectBalanceReport,
  type ProjectBalanceTx,
} from './projectBalance.aggregate';

const orgA = 'org-a';
const orgB = 'org-b';

function tx(
  partial: Partial<ProjectBalanceTx> & Pick<ProjectBalanceTx, 'date' | 'kind'>,
): ProjectBalanceTx {
  return {
    amount: 100,
    currencyCode: 'HUF',
    orgId: orgA,
    orgName: 'Alpha',
    ...partial,
  };
}

describe('aggregateProjectBalanceReport', () => {
  it('separates period flow and cumulative balance', () => {
    const rows: ProjectBalanceTx[] = [
      tx({ date: '2026-01-05', kind: 'revenue', amount: 1000 }),
      tx({ date: '2026-01-20', kind: 'cost', amount: 300 }),
      tx({
        date: '2026-02-10',
        kind: 'revenue',
        amount: 500,
        orgId: orgB,
        orgName: 'Beta',
      }),
    ];
    const report = aggregateProjectBalanceReport(rows, 'thisYear');
    expect(report).not.toBeNull();
    const alpha = report!.byProject.find((row) => row.orgId === orgA)!;
    const huf = alpha.byCurrency.HUF!;
    expect(huf.periodRevenue).toBe(1000);
    expect(huf.periodCost).toBe(300);
    expect(huf.periodNet).toBe(700);
    expect(huf.cumulativeBalance).toBe(700);
    expect(report!.kpis.periodNet).toBeGreaterThan(0);
  });

  it('filters to one organization', () => {
    const rows: ProjectBalanceTx[] = [
      tx({ date: '2026-03-01', kind: 'cost', amount: 50 }),
      tx({
        date: '2026-03-01',
        kind: 'revenue',
        amount: 200,
        orgId: orgB,
        orgName: 'Beta',
      }),
    ];
    const report = aggregateProjectBalanceReport(rows, 'thisMonth', {
      organizationId: orgB,
    });
    expect(report?.byProject).toHaveLength(1);
    expect(report?.byProject[0]?.orgId).toBe(orgB);
  });

  it('returns null when nothing matches', () => {
    expect(aggregateProjectBalanceReport([], 'all')).toBeNull();
  });
});
