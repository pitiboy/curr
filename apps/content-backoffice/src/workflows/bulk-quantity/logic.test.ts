import { describe, expect, it } from 'vitest';

import {
  buildRowPlans,
  buildTransactionPayload,
  duplicateQueryFilters,
  mergeDuplicateMatches,
  mergeRowResults,
  parseQuantityInput,
  plansForRetry,
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
    expect(
      rowsFromQuantities(houses, { 'org-a': 5, 'org-b': '3' }),
    ).toEqual([
      { organizationId: 'org-a', organizationName: '2024 alom', amount: 5 },
      { organizationId: 'org-b', organizationName: '2025 alom', amount: 3 },
    ]);
  });

  it('builds duplicate filters and payloads from config', () => {
    const filters = duplicateQueryFilters({
      date: '2026-10-23',
      organizationId: 'org-a',
      currencyTypeId: 'cur-egg',
      debitAccountId: 'acc-1300',
      creditAccountId: 'acc-4500',
    });
    expect(filters.date).toEqual({ $eq: '2026-10-23' });

    const payload = buildTransactionPayload(
      {
        currencyTypeId: 'cur-egg',
        debitAccountId: 'acc-1300',
        creditAccountId: 'acc-4500',
        transactionTypeId: 'type-atv',
      },
      { organizationId: 'org-a', organizationName: '2024 alom', amount: 12 },
      '2026-10-23',
      'Napi tojás',
    );
    expect(payload).toMatchObject({
      date: '2026-10-23',
      amount: 12,
      organization: 'org-a',
      debit_account: 'acc-1300',
      credit_account: 'acc-4500',
      currency_type: 'cur-egg',
      transaction_type: 'type-atv',
    });
  });

  it('merges draft and published duplicates with published winning', () => {
    const merged = mergeDuplicateMatches(
      [{ documentId: 'tx-1', amount: 1 }],
      [{ documentId: 'tx-1', amount: 9 }],
    );
    expect(merged).toEqual([{ documentId: 'tx-1', amount: 9 }]);
  });

  it('plans insert vs update from conflict choices', () => {
    const rows = [
      { organizationId: 'org-a', organizationName: 'A', amount: 4 },
      { organizationId: 'org-b', organizationName: 'B', amount: 2 },
    ];
    const duplicates = [
      {
        row: rows[0]!,
        existingDocumentId: 'tx-a',
        existingAmount: 1,
      },
    ];
    expect(
      buildRowPlans(rows, duplicates, { 'org-a': 'insert' }),
    ).toEqual([
      { ...rows[0], action: 'insert' },
      { ...rows[1], action: 'insert' },
    ]);
    expect(
      buildRowPlans(rows, duplicates, { 'org-a': 'update' }),
    ).toEqual([
      { ...rows[0], action: 'update', updateDocumentId: 'tx-a' },
      { ...rows[1], action: 'insert' },
    ]);
  });

  it('aggregates retry results', () => {
    const merged = mergeRowResults(
      [
        {
          organizationId: 'org-a',
          organizationName: 'A',
          status: 'success',
          documentId: 'tx-a',
        },
      ],
      [
        {
          organizationId: 'org-b',
          organizationName: 'B',
          status: 'error',
          message: 'fail',
        },
      ],
    );
    expect(merged).toHaveLength(2);
    expect(plansForRetry(
      [
        {
          organizationId: 'org-a',
          organizationName: 'A',
          amount: 1,
          action: 'insert',
        },
        {
          organizationId: 'org-b',
          organizationName: 'B',
          amount: 2,
          action: 'insert',
        },
      ],
      ['org-b'],
    )).toHaveLength(1);
  });

  it('formats today as ISO date', () => {
    expect(todayIsoDate(new Date('2026-10-23T15:00:00Z'))).toBe('2026-10-23');
  });

  it('rejects negative and fractional quantities', () => {
    expect(parseQuantityInput(-1)).toBeNull();
    expect(parseQuantityInput(1.5)).toBeNull();
  });
});
