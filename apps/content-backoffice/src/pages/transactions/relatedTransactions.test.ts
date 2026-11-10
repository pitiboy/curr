import { describe, expect, it } from 'vitest';

import {
  hasRelatedTransactionLink,
  needsParentFetch,
  parentDocumentId,
  relatedItemsFromRecord,
  relatedTransactionCountHint,
} from './relatedTransactions';

describe('relatedItemsFromRecord', () => {
  it('lists populated children sorted by entry id ascending', () => {
    const record = {
      id: 'anchor',
      related_transactions: [
        { id: 20, documentId: 'b', date: '2026-02-02', amount: 10 },
        { id: 10, documentId: 'a', date: '2026-03-01', amount: 5 },
      ],
    };
    expect(relatedItemsFromRecord(record)).toEqual([
      { documentId: 'a', entryId: 10, date: '2026-03-01', amount: 5 },
      { documentId: 'b', entryId: 20, date: '2026-02-02', amount: 10 },
    ]);
  });

  it('merges parent and siblings when the parent record is loaded', () => {
    const record = {
      id: 'child-b',
      related_transaction: { documentId: 'anchor', date: '2026-02-01' },
    };
    const parent = {
      id: 100,
      documentId: 'anchor',
      date: '2026-02-01',
      related_transactions: [
        { id: 300, documentId: 'child-b', date: '2026-02-03', amount: 2 },
        { id: 200, documentId: 'child-a', date: '2026-02-02', amount: 1 },
      ],
    };
    expect(relatedItemsFromRecord(record, parent)).toEqual([
      { documentId: 'anchor', entryId: 100, date: '2026-02-01' },
      { documentId: 'child-a', entryId: 200, date: '2026-02-02', amount: 1 },
      { documentId: 'child-b', entryId: 300, date: '2026-02-03', amount: 2 },
    ]);
  });

  it('falls back to the parent stub before fetch completes', () => {
    const record = {
      id: 'child',
      related_transaction: {
        id: 55,
        documentId: 'anchor',
        date: '2026-02-01',
        amount: 100,
      },
    };
    expect(relatedItemsFromRecord(record)).toEqual([
      {
        documentId: 'anchor',
        entryId: 55,
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
