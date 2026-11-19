import { describe, expect, it } from 'vitest';

import {
  distributionRequestRows,
  parseQuantityInput,
  rowsFromQuantities,
  todayIsoDate,
} from './logic';

describe('bulk quantity logic', () => {
  const houses = [
    { documentId: 'org-a', name: '2024 alom' },
    { documentId: 'org-b', name: '2025 alom' },
  ];

  it('drops zero and empty quantities', () => {
    expect(
      rowsFromQuantities(houses, { 'org-a': 0, 'org-b': '', 'org-c': 12 }),
    ).toEqual([]);
    expect(rowsFromQuantities(houses, { 'org-a': 5, 'org-b': '3' })).toEqual([
      { organizationId: 'org-a', organizationName: '2024 alom', amount: 5 },
      { organizationId: 'org-b', organizationName: '2025 alom', amount: 3 },
    ]);
  });

  it('keeps member order and drops empty / zero distribution rows', () => {
    expect(
      distributionRequestRows(['m-1', 'm-2', 'm-3'], {
        'm-3': '4',
        'm-1': 2,
        'm-2': 0,
      }),
    ).toEqual([
      { memberId: 'm-1', quantity: 2 },
      { memberId: 'm-3', quantity: 4 },
    ]);
  });

  it('formats today as ISO date', () => {
    expect(todayIsoDate(new Date('2026-10-23T15:00:00Z'))).toBe('2026-10-23');
  });

  it('rejects negative and fractional quantities', () => {
    expect(parseQuantityInput(-1)).toBeNull();
    expect(parseQuantityInput(1.5)).toBeNull();
  });
});
