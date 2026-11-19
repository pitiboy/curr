import { describe, expect, it } from 'vitest';

import { overLinkedTotal, summarizeTransactionUsage } from './transactionUsage';

describe('summarizeTransactionUsage', () => {
  const rows = [
    {
      documentId: 'a1',
      purchase_price: 5000,
      acquisition_transaction: { documentId: 't1' },
    },
    {
      documentId: 'a2',
      purchase_price: '2878',
      acquisition_transaction: { documentId: 't1' },
    },
    {
      documentId: 'a3',
      purchase_price: null,
      acquisition_transaction: { documentId: 't1' },
    },
    {
      documentId: 'a4',
      purchase_price: 10,
      disposal_transaction: { documentId: 't1' },
    },
  ];

  it('counts assets and sums prices per acquisition transaction', () => {
    expect(summarizeTransactionUsage(rows, 'debit').get('t1')).toEqual({
      assetCount: 3,
      linkedTotal: 7878,
    });
  });

  it('uses the disposal relation on the credit side', () => {
    expect(summarizeTransactionUsage(rows, 'credit').get('t1')).toEqual({
      assetCount: 1,
      linkedTotal: 10,
    });
  });

  it('leaves the edited asset out', () => {
    expect(summarizeTransactionUsage(rows, 'debit', 'a1').get('t1')).toEqual({
      assetCount: 2,
      linkedTotal: 2878,
    });
  });
});

describe('overLinkedTotal', () => {
  it('returns the would-be total when it exceeds the transaction', () => {
    expect(
      overLinkedTotal({ assetCount: 1, linkedTotal: 7878 }, 7878, 7878),
    ).toBe(15756);
  });

  it('is null when the assets fit into the amount', () => {
    expect(
      overLinkedTotal({ assetCount: 1, linkedTotal: 5000 }, 2878, 7878),
    ).toBeNull();
    expect(overLinkedTotal(undefined, 7878, 7878)).toBeNull();
  });

  it('is null without a known transaction amount', () => {
    expect(
      overLinkedTotal({ assetCount: 3, linkedTotal: 1e9 }, 1, null),
    ).toBeNull();
  });
});
