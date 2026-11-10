import { describe, expect, it } from 'vitest';

import {
  boundsForPeriodBucket,
  boundsForPreset,
  chartBucketGranularity,
  endDateOfPeriod,
  periodKeyForPreset,
  periodsInRange,
  startDateOfPeriod,
  toIsoDate,
} from './reportDateRange';

describe('boundsForPreset', () => {
  const now = new Date(2026, 10, 6);

  it('maps this month and last 7 days', () => {
    expect(boundsForPreset('thisMonth', now)).toEqual({
      from: '2026-11-01',
      to: '2026-11-06',
    });
    expect(boundsForPreset('last7', now)).toEqual({
      from: '2026-10-31',
      to: '2026-11-06',
    });
  });

  it('maps last month and this year', () => {
    expect(boundsForPreset('lastMonth', now)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(boundsForPreset('thisYear', now)).toEqual({
      from: '2026-01-01',
      to: '2026-11-06',
    });
  });

  it('leaves all-time start open', () => {
    expect(boundsForPreset('all', now)).toEqual({
      from: null,
      to: '2026-11-06',
    });
  });
});

describe('periodKeyForPreset', () => {
  it('buckets long ranges by month', () => {
    expect(periodKeyForPreset('2026-11-06', 'all')).toBe('2026-11');
    expect(periodKeyForPreset('2026-11-06', 'thisYear')).toBe('2026-11');
    expect(periodKeyForPreset('2026-11-06', 'thisMonth')).toBe('2026-11-06');
  });
});

describe('chartBucketGranularity', () => {
  it('uses month for all/thisYear and day for month/week presets', () => {
    expect(chartBucketGranularity('all')).toBe('month');
    expect(chartBucketGranularity('thisYear')).toBe('month');
    expect(chartBucketGranularity('thisMonth')).toBe('day');
    expect(chartBucketGranularity('last7')).toBe('day');
  });
});

describe('endDateOfPeriod', () => {
  it('returns last day of month for monthly buckets', () => {
    expect(endDateOfPeriod('2026-02', 'all')).toBe('2026-02-28');
    expect(endDateOfPeriod('2026-11-09', 'thisMonth')).toBe('2026-11-09');
  });
});

describe('startDateOfPeriod and boundsForPeriodBucket', () => {
  it('returns month start and full bucket bounds', () => {
    expect(startDateOfPeriod('2026-02', 'all')).toBe('2026-02-01');
    expect(boundsForPeriodBucket('2026-02', 'all')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(boundsForPeriodBucket('2026-11-09', 'thisMonth')).toEqual({
      from: '2026-11-09',
      to: '2026-11-09',
    });
  });
});

describe('periodsInRange', () => {
  it('lists daily buckets inside last7', () => {
    const bounds = boundsForPreset('last7', new Date(2026, 10, 6));
    expect(periodsInRange('last7', bounds, '2026-10-31')).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ]);
  });
});

describe('toIsoDate', () => {
  it('formats local calendar date', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
