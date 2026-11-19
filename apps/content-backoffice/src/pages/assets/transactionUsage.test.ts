import { describe, expect, it, vi } from 'vitest';

import {
  loadTransactionUsage,
  overLinkedTotal,
  summarizeTransactionUsage,
} from './transactionUsage';

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

describe('loadTransactionUsage', () => {
  function fakeClient(rows: unknown[]) {
    const urls: string[] = [];
    const client = vi.fn(async (url: string) => {
      urls.push(decodeURIComponent(url));
      return { json: { data: rows, meta: { pagination: { pageCount: 1 } } } };
    });
    return { client, urls };
  }

  it('queries the acquisition relation on the debit side', async () => {
    const { client, urls } = fakeClient([
      {
        documentId: 'a1',
        purchase_price: 100,
        acquisition_transaction: { documentId: 't1' },
      },
    ]);
    const usage = await loadTransactionUsage(
      client as never,
      ['t1', 't2'],
      'debit',
    );
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/api/assets?');
    expect(urls[0]).toContain(
      'filters[acquisition_transaction][documentId][$in][0]=t1',
    );
    expect(urls[0]).toContain('[$in][1]=t2');
    expect(usage.get('t1')).toEqual({ assetCount: 1, linkedTotal: 100 });
  });

  it('queries the disposal relation on the credit side', async () => {
    const { client, urls } = fakeClient([]);
    await loadTransactionUsage(client as never, ['t1'], 'credit');
    expect(urls[0]).toContain(
      'filters[disposal_transaction][documentId][$in][0]=t1',
    );
  });

  it('does not call the API without transaction ids', async () => {
    const { client } = fakeClient([]);
    expect(
      (await loadTransactionUsage(client as never, [], 'debit')).size,
    ).toBe(0);
    expect(client).not.toHaveBeenCalled();
  });
});
