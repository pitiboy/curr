import { describe, expect, it } from 'vitest';

import {
  boundsForPreset,
  periodKeyForPreset,
  periodsInRange,
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
