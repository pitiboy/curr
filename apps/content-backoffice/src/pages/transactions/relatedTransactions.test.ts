import { describe, expect, it } from 'vitest';

import {
  hasRelatedTransactionLink,
  needsParentFetch,
  parentDocumentId,
  purgeExpansionPlan,
  relatedItemsFromRecord,
  relatedRowDeleteState,
  relatedTransactionCountHint,
} from './relatedTransactions';

describe('relatedItemsFromRecord', () => {
  it('lists itself and its children sorted by entry id ascending', () => {
    const record = {
      id: 'anchor',
      entryId: 5,
      related_transactions: [
        { id: 20, documentId: 'b', date: '2026-02-02', amount: 10 },
        { id: 10, documentId: 'a', date: '2026-03-01', amount: 5 },
      ],
    };
    expect(relatedItemsFromRecord(record)).toEqual([
      { documentId: 'anchor', entryId: 5 },
      { documentId: 'a', entryId: 10, date: '2026-03-01', amount: 5 },
      { documentId: 'b', entryId: 20, date: '2026-02-02', amount: 10 },
    ]);
  });

  it('a record with children and a parent lists parent, itself and children', () => {
    const record = {
      id: 'mid',
      documentId: 'mid',
      entryId: 1937,
      related_transaction: { documentId: 'top' },
      related_transactions: [{ id: 1947, documentId: 'leaf' }],
    };
    const parent = {
      id: 'top',
      documentId: 'top',
      entryId: 1933,
      related_transactions: [{ id: 1937, documentId: 'mid' }],
    };
    expect(
      relatedItemsFromRecord(record, parent).map((item) => [
        item.documentId,
        item.entryId,
      ]),
    ).toEqual([
      ['top', 1933],
      ['mid', 1937],
      ['leaf', 1947],
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
      { documentId: 'child' },
    ]);
  });
});

describe('needsParentFetch', () => {
  it('fetches the parent even when children are populated', () => {
    expect(
      needsParentFetch({
        related_transactions: [{ documentId: 'x' }],
        related_transaction: { documentId: 'y' },
      }),
    ).toBe(true);
    expect(
      needsParentFetch({ related_transactions: [{ documentId: 'x' }] }),
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

describe('expansion delete helpers', () => {
  const family = [
    { documentId: 'orig', converted_to_workflow: 'original' as const },
    { documentId: 'storno', converted_to_workflow: 'storno' as const },
    { documentId: 'step', converted_to_workflow: 'expanded' as const },
    { documentId: 'plain', converted_to_workflow: null },
  ];

  it('only expanded rows are deletable while any expanded row remains', () => {
    expect(family.map((item) => relatedRowDeleteState(item, family))).toEqual([
      'blocked_expanded',
      'blocked_expanded',
      'allowed',
      'blocked_expanded',
    ]);
  });

  it('then storno and plain rows; the original only after the storno', () => {
    const noExpanded = family.filter((item) => item.documentId !== 'step');
    expect(
      noExpanded.map((item) => relatedRowDeleteState(item, noExpanded)),
    ).toEqual(['blocked_storno', 'allowed', 'allowed']);
    const onlyOriginal = [family[0], family[3]];
    expect(relatedRowDeleteState(family[0], onlyOriginal)).toBe('allowed');
  });

  const ids = (plan: ReturnType<typeof purgeExpansionPlan>) =>
    plan?.rows.map((row) => row.documentId);

  it('targets the original on its own Show', () => {
    const plan = purgeExpansionPlan(family.slice(1), {
      id: 'orig',
      converted_to_workflow: 'original',
      related_transactions: family.slice(1),
    });
    expect(plan?.parentDocumentId).toBe('orig');
    expect(plan?.isOriginal).toBe(true);
    expect(ids(plan)).toEqual(['storno', 'step']);
  });

  it('targets the parent original from a child Show', () => {
    const plan = purgeExpansionPlan(family, {
      id: 'step',
      converted_to_workflow: 'expanded',
      related_transaction: { documentId: 'orig' },
    });
    expect(plan?.parentDocumentId).toBe('orig');
    expect(plan?.isOriginal).toBe(true);
  });

  it('targets a non-original anchor that has expanded children', () => {
    const items = [
      { documentId: 'anchor', converted_to_workflow: null },
      { documentId: 'leg-1', converted_to_workflow: null },
      { documentId: 'leg-2', converted_to_workflow: 'expanded' as const },
    ];
    const plan = purgeExpansionPlan(items, {
      id: 'leg-1',
      related_transaction: { documentId: 'anchor' },
    });
    expect(plan).toEqual({
      parentDocumentId: 'anchor',
      isOriginal: false,
      rows: [items[2]],
    });
  });

  it('returns null without expanded or storno children', () => {
    expect(
      purgeExpansionPlan([family[3]], {
        id: 'orig',
        converted_to_workflow: 'original',
        related_transactions: [family[3]],
      }),
    ).toBeNull();
    expect(purgeExpansionPlan([], { id: 'lonely' })).toBeNull();
  });
});
