import { describe, expect, it } from 'vitest';

import {
  hasRelatedTransactionLink,
  needsParentFetch,
  parentDocumentId,
  relatedItemsFromRecord,
  relatedTransactionCountHint,
} from './relatedTransactions';

describe('relatedItemsFromRecord', () => {
  it('lists populated children when the record is the parent', () => {
    const record = {
      id: 'anchor',
      related_transactions: [
        { documentId: 'b', date: '2026-02-02', amount: 10 },
        { documentId: 'a', date: '2026-02-01', amount: 5 },
      ],
    };
    expect(relatedItemsFromRecord(record)).toEqual([
      { documentId: 'a', date: '2026-02-01', amount: 5 },
      { documentId: 'b', date: '2026-02-02', amount: 10 },
    ]);
  });

  it('merges parent and siblings when the parent record is loaded', () => {
    const record = {
      id: 'child-b',
      related_transaction: { documentId: 'anchor', date: '2026-02-01' },
    };
    const parent = {
      id: 'anchor',
      documentId: 'anchor',
      date: '2026-02-01',
      related_transactions: [
        { documentId: 'child-a', date: '2026-02-02', amount: 1 },
        { documentId: 'child-b', date: '2026-02-03', amount: 2 },
      ],
    };
    expect(relatedItemsFromRecord(record, parent)).toEqual([
      { documentId: 'anchor', date: '2026-02-01' },
      { documentId: 'child-a', date: '2026-02-02', amount: 1 },
      { documentId: 'child-b', date: '2026-02-03', amount: 2 },
    ]);
  });

  it('falls back to the parent stub before fetch completes', () => {
    const record = {
      id: 'child',
      related_transaction: {
        documentId: 'anchor',
        date: '2026-02-01',
        amount: 100,
      },
    };
    expect(relatedItemsFromRecord(record)).toEqual([
      {
        documentId: 'anchor',
        date: '2026-02-01',
        amount: 100,
      },
    ]);
  });
});

describe('needsParentFetch', () => {
  it('skips fetch when children are already populated', () => {
    expect(
      needsParentFetch({
        related_transactions: [{ documentId: 'x' }],
        related_transaction: { documentId: 'y' },
      }),
    ).toBe(false);
  });

  it('requests parent when only related_transaction is set', () => {
    expect(
      needsParentFetch({
        related_transaction: { documentId: 'anchor' },
      }),
    ).toBe(true);
  });
});

describe('parentDocumentId', () => {
  it('reads documentId from the relation', () => {
    expect(
      parentDocumentId({ related_transaction: { documentId: 'doc-1' } }),
    ).toBe('doc-1');
  });
});

describe('hasRelatedTransactionLink', () => {
  it('is true when children or parent is set', () => {
    expect(
      hasRelatedTransactionLink({
        related_transactions: [{ documentId: 'a' }],
      }),
    ).toBe(true);
    expect(
      hasRelatedTransactionLink({
        related_transaction: { documentId: 'p' },
      }),
    ).toBe(true);
    expect(hasRelatedTransactionLink({})).toBe(false);
  });
});

describe('relatedTransactionCountHint', () => {
  it('returns child count when populated', () => {
    expect(
      relatedTransactionCountHint({
        related_transactions: [{ documentId: 'a' }, { documentId: 'b' }],
      }),
    ).toBe(2);
  });
});
