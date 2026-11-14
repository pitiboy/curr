import { describe, expect, it } from 'vitest';

import {
  alomProducedDailyAverage,
  averageProducedPerBucket,
  producedInPeriod,
} from './eggInventory.helpers';
import type { EggTimeseriesPoint } from './types';

function point(
  partial: Pick<EggTimeseriesPoint, 'byAlom'> & Partial<EggTimeseriesPoint>,
): EggTimeseriesPoint {
  return {
    period: '2026-11-01',
    distributedInternal: 0,
    distributedSale: 0,
    byMemberTotal: {},
    ...partial,
  };
}

describe('eggInventory.helpers averages', () => {
  it('producedInPeriod sums alom buckets', () => {
    expect(
      producedInPeriod(point({ byAlom: { '2025 alom': 3, '2026 alom': 12 } })),
    ).toBe(15);
  });

  it('averageProducedPerBucket is total over bucket count', () => {
    const timeseries: EggTimeseriesPoint[] = [
      point({ period: 'a', byAlom: { '2026 alom': 10 } }),
      point({ period: 'b', byAlom: { '2026 alom': 20 } }),
      point({ period: 'c', byAlom: { '2026 alom': 0 } }),
    ];
    expect(averageProducedPerBucket(timeseries)).toBe(10);
    expect(averageProducedPerBucket([])).toBeNull();
  });

  it('alomProducedDailyAverage divides by bucket count', () => {
    expect(alomProducedDailyAverage(81, 9)).toBe(9);
    expect(alomProducedDailyAverage(10, 0)).toBeNull();
  });
});
