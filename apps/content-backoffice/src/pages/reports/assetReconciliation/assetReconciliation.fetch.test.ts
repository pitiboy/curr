import { describe, expect, it } from 'vitest';

import {
  resetGlobalFilters,
  type GlobalTransactionFilters,
} from '../../../filters/globalTransactionFilters';
import {
  assetReconciliationQueries,
  fetchAssetReconciliation,
  mapReconciliationAsset,
} from './assetReconciliation.fetch';

const NOW = new Date('2026-11-15T12:00:00Z');

describe('assetReconciliationQueries (global sidebar filters)', () => {
  it('uses status, range end, converted, organization and currency', () => {
    const state: GlobalTransactionFilters = {
      ...resetGlobalFilters(),
      datePreset: 'custom',
      date_gte: '2026-01-01',
      date_lte: '2026-06-30',
      status: 'all',
      organization: 'org-a',
      currency_type: 'HUF',
    };
    const queries = assetReconciliationQueries(state, NOW);
    expect(queries.transactionStatus).toBe('all');
    expect(queries.asOf).toBe('2026-06-30');
    const and = (queries.transactionFilters as { $and: unknown[] }).$and;
    expect(and).toContainEqual({
      $or: [
        { debit_account: { code: { $eq: '1500' } } },
        { credit_account: { code: { $eq: '1500' } } },
      ],
    });
    // Balance: everything up to the range end, not only inside the range.
    expect(and).toContainEqual({ date: { $lte: '2026-06-30' } });
    expect(JSON.stringify(and)).not.toContain('$gte');
    expect(and).toContainEqual({
      organization: { documentId: { $eq: 'org-a' } },
    });
    expect(and).toContainEqual({ currency_type: { code: { $eq: 'HUF' } } });
    expect(queries.assetFilters).toEqual({
      $and: [
        { organization: { documentId: { $eq: 'org-a' } } },
        { currency_type: { code: { $eq: 'HUF' } } },
      ],
    });
  });

  it('changes its request key when a relevant filter changes', () => {
    const base = resetGlobalFilters();
    const a = assetReconciliationQueries(base, NOW).key;
    const b = assetReconciliationQueries(
      { ...base, organization: 'org-b' },
      NOW,
    ).key;
    expect(a).not.toBe(b);
    expect(assetReconciliationQueries(base, NOW).assetFilters).toEqual({});
  });
});

describe('mapReconciliationAsset', () => {
  it('drops assets acquired after the balance date', () => {
    expect(
      mapReconciliationAsset(
        {
          documentId: 'a',
          purchase_date: '2026-12-01',
          acquisition_transaction: null,
        },
        '2026-11-30',
      ),
    ).toBeNull();
    expect(
      mapReconciliationAsset(
        {
          documentId: 'a',
          purchase_price: '12.5',
          acquisition_transaction: { documentId: 't', date: '2026-01-01' },
        },
        '2026-11-30',
      ),
    ).toMatchObject({ purchasePrice: 12.5, acquisitionTransactionId: 't' });
  });
});

describe('fetchAssetReconciliation', () => {
  it('loads 1500 rows + assets and aggregates them', async () => {
    const urls: string[] = [];
    const httpClient = async (url: string) => {
      urls.push(url);
      if (url.includes('/api/assets')) {
        return {
          json: {
            data: [
              {
                documentId: 'a1',
                name: 'Traktor',
                ownership_type: 'coop_owned',
                status: 'in_use',
                purchase_price: '1000',
                currency_type: { code: 'HUF' },
                acquisition_transaction: {
                  documentId: 'tx1',
                  date: '2026-02-01',
                },
              },
            ],
            meta: { pagination: { pageCount: 1 } },
          },
        };
      }
      return {
        json: {
          data: [
            {
              documentId: 'tx1',
              date: '2026-02-01',
              amount: '1000',
              debit_account: { code: '1500' },
              credit_account: { code: '2000' },
              currency_type: { code: 'HUF' },
            },
          ],
          meta: { pagination: { pageCount: 1 } },
        },
      };
    };
    const report = await fetchAssetReconciliation(
      httpClient,
      assetReconciliationQueries(resetGlobalFilters(), NOW),
    );
    expect(report.ok).toBe(true);
    expect(report.rows).toEqual([
      expect.objectContaining({ currencyCode: 'HUF', difference: 0 }),
    ]);
    expect(urls.some((url) => url.includes('/api/transactions?'))).toBe(true);
    expect(urls.some((url) => url.includes('status=published'))).toBe(true);
  });
});
