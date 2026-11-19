import { describe, expect, it } from 'vitest';

import {
  excludeAcquisitionDeals,
  searchTransactionsForPicker,
  transactionOptionLabel,
  transactionPickerFilters,
} from './transactionPicker';

const KOR_EXCLUSION = { currency_type: { code: { $ne: 'KOR' } } };

describe('transactionPickerFilters', () => {
  it('suggests 1500 debit rows for an empty acquisition search', () => {
    const { $and } = transactionPickerFilters('  ', 'debit') as {
      $and: unknown[];
    };
    expect($and).toContainEqual({
      debit_account: { code: { $eq: '1500' } },
    });
  });

  it('suggests 1500 credit rows for an empty disposal search', () => {
    const { $and } = transactionPickerFilters('', 'credit') as {
      $and: unknown[];
    };
    expect($and).toContainEqual({
      credit_account: { code: { $eq: '1500' } },
    });
  });

  it('searches description / documentId, and amount for numbers', () => {
    const { $and } = transactionPickerFilters('125 000', 'debit') as {
      $and: Array<Record<string, unknown>>;
    };
    expect($and[$and.length - 1]).toEqual({
      $or: [
        { description: { $containsi: '125 000' } },
        { documentId: { $eq: '125 000' } },
        { amount: { $eq: 125000 } },
      ],
    });
    const text = transactionPickerFilters('traktor', 'debit') as {
      $and: Array<Record<string, unknown>>;
    };
    expect(JSON.stringify(text)).not.toContain('"amount"');
  });
});

describe('text search narrows, never widens', () => {
  it('keeps the 1500 side constraint while searching', () => {
    const debit = transactionPickerFilters('kapa', 'debit') as {
      $and: unknown[];
    };
    expect(debit.$and).toContainEqual({
      debit_account: { code: { $eq: '1500' } },
    });
    const credit = transactionPickerFilters('kapa', 'credit') as {
      $and: unknown[];
    };
    expect(credit.$and).toContainEqual({
      credit_account: { code: { $eq: '1500' } },
    });
  });
});

describe('KOR exclusion', () => {
  it('never offers KOR rows, on either side or search mode', () => {
    for (const side of ['debit', 'credit'] as const) {
      for (const search of ['', 'kapa']) {
        const { $and } = transactionPickerFilters(search, side) as {
          $and: unknown[];
        };
        expect($and).toContainEqual(KOR_EXCLUSION);
      }
    }
  });
});

describe('excludeAcquisitionDeals', () => {
  it('drops legs of deals that also debit 1500, keeps standalone disposals', () => {
    const rows = [
      { documentId: 'fedezet', related_transaction: { documentId: 'buy' } },
      { documentId: 'selejt', related_transaction: { documentId: 'scrap' } },
      { documentId: 'raw' },
    ];
    expect(
      excludeAcquisitionDeals(rows, new Set(['buy'])).map((r) => r.documentId),
    ).toEqual(['selejt', 'raw']);
  });
});

describe('searchTransactionsForPicker', () => {
  const candidates = [
    {
      documentId: 'fedezet',
      date: '2026-11-19',
      amount: '3434',
      description: 'kapa | HUF fedezet',
      currency_type: { code: 'HUF' },
      related_transaction: { documentId: 'buy' },
    },
    {
      documentId: 'selejt',
      date: '2026-11-20',
      amount: '3434',
      description: 'kapa | Eszköz selejtezés',
      currency_type: { code: 'HUF' },
      related_transaction: { documentId: 'scrap' },
    },
  ];

  function fakeClient() {
    const urls: string[] = [];
    const client = async (url: string) => {
      urls.push(decodeURIComponent(url));
      const isDealLookup = decodeURIComponent(url).includes('[$in]');
      const published = url.includes('status=published');
      const data = !published
        ? []
        : isDealLookup
          ? [
              {
                documentId: 'telek',
                related_transaction: { documentId: 'buy' },
              },
            ]
          : candidates;
      return { json: { data, meta: { pagination: { pageCount: 1 } } } };
    };
    return { client, urls };
  }

  it('hides acquisition-deal legs on the disposal side', async () => {
    const { client, urls } = fakeClient();
    const options = await searchTransactionsForPicker(
      client as never,
      '',
      'credit',
    );
    expect(options.map((o) => o.id)).toEqual(['selejt']);
    expect(urls.some((u) => u.includes('[$in]'))).toBe(true);
  });

  it('skips the deal lookup on the acquisition side', async () => {
    const { client, urls } = fakeClient();
    await searchTransactionsForPicker(client as never, '', 'debit');
    expect(urls.some((u) => u.includes('[$in]'))).toBe(false);
  });
});

describe('transactionOptionLabel', () => {
  it('joins date, amount + currency and description', () => {
    expect(
      transactionOptionLabel({
        documentId: 'tx',
        date: '2026-01-02',
        amount: '1000',
        description: 'Traktor',
        currency_type: { code: 'HUF' },
      }),
    ).toBe('2026-01-02 · 1000 HUF · Traktor');
  });
});
