import { describe, expect, it } from 'vitest';

import {
  ASSET_CREATE_PATH,
  assetCreatePathAfterBooking,
  assetCreatePathWithPrefill,
  buildAssetPrefillRecord,
  pickAcquisitionTransactionId,
} from './assetPrefill';

function sourceFromPath(path: string): Record<string, unknown> {
  const url = new URL(path, 'http://localhost');
  expect(url.pathname).toBe(ASSET_CREATE_PATH);
  return JSON.parse(url.searchParams.get('source') ?? '{}');
}

describe('buildAssetPrefillRecord', () => {
  it('maps price, currency, date, organization and the linked transaction', () => {
    expect(
      buildAssetPrefillRecord({
        amount: '125000.50',
        currencyTypeId: 'cur-huf',
        date: '2026-11-03',
        organizationId: 'org-a',
        description: 'Fűkasza Stihl | Eszköz beszerzés – szállítói számla',
        acquisitionTransactionId: 'tx-1500',
      }),
    ).toEqual({
      name: 'Fűkasza Stihl',
      ownership_type: 'coop_owned',
      status: 'in_use',
      purchase_price: 125000.5,
      currency_type: 'cur-huf',
      purchase_date: '2026-11-03',
      organization: 'org-a',
      acquisition_transaction: 'tx-1500',
    });
  });

  it('leaves out missing / invalid values', () => {
    expect(
      buildAssetPrefillRecord({ amount: 'abc', date: '', description: ' ' }),
    ).toEqual({ ownership_type: 'coop_owned', status: 'in_use' });
  });
});

describe('assetCreatePathWithPrefill', () => {
  it('encodes the record as the React Admin `source` param', () => {
    const record = buildAssetPrefillRecord({
      amount: 10,
      organizationId: 'org-a',
    });
    expect(sourceFromPath(assetCreatePathWithPrefill(record))).toEqual(record);
  });
});

describe('pickAcquisitionTransactionId', () => {
  const legs = [
    { documentId: 'leg-pay', amount: 100, debit_account: { code: '2000' } },
    { documentId: 'leg-1500', amount: 100, debit_account: { code: '1500' } },
  ];

  it('links the first booked leg that debits 1500', () => {
    expect(
      pickAcquisitionTransactionId(['leg-pay', 'leg-1500'], legs, 'orig'),
    ).toBe('leg-1500');
  });

  it('falls back to the original when no leg debits 1500', () => {
    expect(pickAcquisitionTransactionId(['leg-pay'], legs, 'orig')).toBe(
      'orig',
    );
    expect(pickAcquisitionTransactionId([], [], 'orig')).toBe('orig');
  });
});

describe('assetCreatePathAfterBooking', () => {
  it('loads the booked original + legs and builds the prefilled path', async () => {
    const seen: string[] = [];
    const httpClient = async (url: string) => {
      seen.push(url);
      if (url.includes('/api/transactions/tx-orig')) {
        const published = url.includes('status=published');
        return {
          json: {
            data: published
              ? null
              : {
                  documentId: 'tx-orig',
                  amount: '80000',
                  date: '2026-10-01',
                  description: 'Szivattyú',
                  currency_type: { documentId: 'cur-huf', code: 'HUF' },
                  organization: { documentId: 'org-a', name: 'A' },
                },
          },
        };
      }
      const published = url.includes('status=published');
      return {
        json: {
          data: published
            ? [
                {
                  documentId: 'leg-1500',
                  amount: '80000',
                  debit_account: { code: '1500' },
                },
                {
                  documentId: 'leg-pay',
                  amount: '80000',
                  debit_account: { code: '2000' },
                },
              ]
            : [],
          meta: { pagination: { pageCount: 1 } },
        },
      };
    };

    const path = await assetCreatePathAfterBooking(
      httpClient,
      'http://localhost:1337',
      {
        originalDocumentId: 'tx-orig',
        createdDocumentIds: ['leg-1500', 'leg-pay'],
      },
    );

    expect(sourceFromPath(path)).toEqual({
      name: 'Szivattyú',
      ownership_type: 'coop_owned',
      status: 'in_use',
      purchase_price: 80000,
      currency_type: 'cur-huf',
      purchase_date: '2026-10-01',
      organization: 'org-a',
      acquisition_transaction: 'leg-1500',
    });
    const legQuery = seen.find((url) => url.includes('filters'));
    expect(decodeURIComponent(legQuery ?? '')).toContain(
      'filters[documentId][$in][0]=leg-1500',
    );
  });
});
