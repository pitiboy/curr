import { describe, expect, it, vi } from 'vitest';

import { collectBulkQuantityDuplicates } from './duplicateFetch';

describe('collectBulkQuantityDuplicates', () => {
  const strapiUrl = 'http://localhost:1337';

  it('groups same account triple into one draft+published pair', async () => {
    const httpClient = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('status=draft')) {
        return {
          json: {
            data: [
              {
                documentId: 'tx-1',
                amount: 5,
                organization: { documentId: 'org-a' },
                currency_type: { documentId: 'cur-1' },
                debit_account: { documentId: 'd-1' },
                credit_account: { documentId: 'c-1' },
              },
            ],
            meta: { pagination: { pageCount: 1 } },
          },
        };
      }
      if (u.includes('status=published')) {
        return {
          json: { data: [], meta: { pagination: { pageCount: 1 } } },
        };
      }
      throw new Error(`unexpected url: ${u}`);
    });

    const dups = await collectBulkQuantityDuplicates(
      httpClient,
      strapiUrl,
      '2026-11-06',
      [
        {
          organizationId: 'org-a',
          organizationLabel: 'House A',
          amount: 10,
          currencyTypeId: 'cur-1',
          debitAccountId: 'd-1',
          creditAccountId: 'c-1',
        },
        {
          organizationId: 'org-b',
          organizationLabel: 'House B',
          amount: 3,
          currencyTypeId: 'cur-1',
          debitAccountId: 'd-1',
          creditAccountId: 'c-1',
        },
      ],
    );

    expect(httpClient).toHaveBeenCalledTimes(2);
    const urls = httpClient.mock.calls.map((c) =>
      decodeURIComponent(String(c[0])),
    );
    expect(
      urls.some((u) =>
        u.includes('filters[organization][documentId][$in][0]=org-a'),
      ),
    ).toBe(true);
    expect(
      urls.some((u) =>
        u.includes('filters[organization][documentId][$in][1]=org-b'),
      ),
    ).toBe(true);
    expect(dups).toHaveLength(1);
    expect(
      dups.find((d) => d.row.organizationId === 'org-a')?.existingDocumentId,
    ).toBe('tx-1');
    expect(dups.find((d) => d.row.organizationId === 'org-b')).toBeUndefined();
  });

  it('runs separate draft+published for distinct account groups', async () => {
    const httpClient = vi.fn(async (url: string) => ({
      json: { data: [], meta: { pagination: { pageCount: 1 } } },
    }));

    await collectBulkQuantityDuplicates(httpClient, strapiUrl, '2026-11-06', [
      {
        organizationId: 'o1',
        organizationLabel: 'a',
        amount: 1,
        currencyTypeId: 'cur-a',
        debitAccountId: 'd-a',
        creditAccountId: 'c-a',
      },
      {
        organizationId: 'o2',
        organizationLabel: 'b',
        amount: 2,
        currencyTypeId: 'cur-b',
        debitAccountId: 'd-b',
        creditAccountId: 'c-b',
      },
    ]);

    expect(httpClient).toHaveBeenCalledTimes(4);
  });
});
