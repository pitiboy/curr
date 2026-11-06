import { describe, expect, it } from 'vitest';

import {
  fetchMembershipShareMock,
  filterReportByFocus,
  getMembershipShareReport,
  historyAmountForFocus,
  memberFocusTotal,
  mergeCurrencyAmounts,
} from './membershipShare.mock';
import type { DateRangePreset } from './types';

const PRESETS_WITH_DATA: DateRangePreset[] = [
  'all',
  'thisMonth',
  'lastMonth',
  'thisYear',
];

describe('membership-share mock consistency', () => {
  it.each(PRESETS_WITH_DATA)('%s: member rows sum to KPIs', (preset) => {
    const report = getMembershipShareReport(preset);
    expect(report).not.toBeNull();
    if (!report) return;

    const share = mergeCurrencyAmounts(
      ...report.byMember.map((row) => row.shareByCurrency),
    );
    const pocket = mergeCurrencyAmounts(
      ...report.byMember.map((row) => row.pocketByCurrency),
    );
    expect(share).toEqual(report.kpis.shareByCurrency);
    expect(pocket).toEqual(report.kpis.pocketByCurrency);
  });

  it('last7 is empty', () => {
    expect(getMembershipShareReport('last7')).toBeNull();
  });

  it('share focus zeros pocket amounts', () => {
    const base = getMembershipShareReport('thisMonth');
    expect(base).not.toBeNull();
    if (!base) return;
    const filtered = filterReportByFocus(base, 'share');
    expect(filtered.kpis.paymentCount).toBe(base.kpis.sharePaymentCount);
    expect(filtered.kpis.pocketByCurrency).toEqual([]);
    expect(
      filtered.byMember.every((row) => row.pocketByCurrency.length === 0),
    ).toBe(true);
    expect(filtered.byMember.length).toBeGreaterThan(0);
    expect(
      filtered.history.every((point) =>
        Object.values(point.byMember).every((amounts) => amounts.pocket === 0),
      ),
    ).toBe(true);
  });

  it('history HUF totals match member rows', () => {
    const report = getMembershipShareReport('all');
    expect(report).not.toBeNull();
    if (!report) return;
    for (const row of report.byMember) {
      const fromHistory = report.history.reduce(
        (sum, point) =>
          sum +
          historyAmountForFocus(
            point.byMember[row.memberId] ?? { share: 0, pocket: 0 },
            'both',
          ),
        0,
      );
      const expected =
        (row.shareByCurrency.find((c) => c.currency === report.historyCurrency)
          ?.amount ?? 0) +
        (row.pocketByCurrency.find((c) => c.currency === report.historyCurrency)
          ?.amount ?? 0);
      expect(fromHistory).toBe(expected);
    }
  });

  it('members are sorted by focus total descending', () => {
    const report = getMembershipShareReport('all');
    expect(report).not.toBeNull();
    if (!report) return;
    const totals = report.byMember.map((row) => memberFocusTotal(row, 'both'));
    for (let i = 1; i < totals.length; i += 1) {
      expect(totals[i - 1]!).toBeGreaterThanOrEqual(totals[i]!);
    }
  });

  it('fetch resolves mock data', async () => {
    const report = await fetchMembershipShareMock('thisMonth', {
      delayMs: 0,
    });
    expect(report?.kpis.paymentCount).toBeGreaterThan(0);
  });

  it('fetch rejects when forceError', async () => {
    await expect(
      fetchMembershipShareMock('thisMonth', {
        delayMs: 0,
        forceError: true,
      }),
    ).rejects.toThrow(/mock failure/);
  });
});
