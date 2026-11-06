import { describe, expect, it } from 'vitest';

import {
  buildKpis,
  fetchEggInventoryReport,
  getEggInventoryReport,
  memberTotal,
} from './eggInventory.mock';
import type { DateRangePreset } from './types';

const PRESETS_WITH_DATA: DateRangePreset[] = [
  'all',
  'thisMonth',
  'lastMonth',
  'thisYear',
];

describe('egg inventory mock consistency', () => {
  it.each(PRESETS_WITH_DATA)('%s: KPI identities hold', (preset) => {
    const report = getEggInventoryReport(preset);
    expect(report).not.toBeNull();
    if (!report) return;

    const { kpis, byMember } = report;
    expect(kpis.internalTotal + kpis.saleTotal).toBe(kpis.distributed);
    expect(kpis.produced - kpis.distributed).toBe(kpis.remaining);

    const memberInternal = byMember.reduce((s, r) => s + r.internalQty, 0);
    const memberSale = byMember.reduce((s, r) => s + r.saleQty, 0);
    expect(memberInternal).toBe(kpis.internalTotal);
    expect(memberSale).toBe(kpis.saleTotal);

    const alomProduced = report.byAlom.reduce((s, r) => s + r.produced, 0);
    expect(alomProduced).toBe(kpis.produced);
  });

  it('last7 is empty', () => {
    expect(getEggInventoryReport('last7')).toBeNull();
  });

  it('buildKpis derives remaining and distributed', () => {
    expect(buildKpis(100, 30, 40)).toEqual({
      produced: 100,
      distributed: 70,
      remaining: 30,
      internalTotal: 30,
      saleTotal: 40,
    });
  });

  it('members are sorted by total descending', () => {
    const report = getEggInventoryReport('all');
    expect(report).not.toBeNull();
    if (!report) return;
    const totals = report.byMember.map(memberTotal);
    for (let i = 1; i < totals.length; i += 1) {
      expect(totals[i - 1]!).toBeGreaterThanOrEqual(totals[i]!);
    }
  });

  it('fetch resolves mock data', async () => {
    const report = await fetchEggInventoryReport('thisMonth', { delayMs: 0 });
    expect(report?.kpis.produced).toBeGreaterThan(0);
  });

  it('fetch rejects when forceError', async () => {
    await expect(
      fetchEggInventoryReport('thisMonth', { delayMs: 0, forceError: true }),
    ).rejects.toThrow(/mock failure/);
  });
});
