import { describe, expect, it } from 'vitest';

import {
  assembleTransactionList,
  buildTransactionFilters,
  encodeStrapiQuery,
  firstReceiptVendor,
  preferTransaction,
  transactionPopulate,
  type StrapiTransaction,
} from './transactionList';
import { loadTransactionRecord } from './transactionRecord';

const draftOnly: StrapiTransaction = {
  id: 1,
  documentId: 'draft-only',
  date: '2026-02-01',
  amount: '10.00',
  description: 'piszkozat',
  organization: { documentId: 'org-1', name: 'Kör' },
  receipts: [],
};

const publishedTwin: StrapiTransaction = {
  id: 2,
  documentId: 'both',
  date: '2026-01-15',
  amount: '9',
  description: 'published copy',
  receipts: [{ documentId: 'receipt-1' }],
};

const draftTwin: StrapiTransaction = {
  id: 3,
  documentId: 'both',
  date: '2026-01-15',
  amount: '9',
  description: 'draft copy',
};

describe('assembleTransactionList', () => {
  it('shows draft-only rows and one published row for the same documentId', () => {
    const { data, total } = assembleTransactionList(
      [draftOnly, draftTwin],
      [publishedTwin],
      {},
    );
    expect(total).toBe(2);
    expect(data.map((row) => [row.id, row.status, row.documentId])).toEqual([
      ['draft-only', 'draft', 'draft-only'],
      ['both', 'published', 'both'],
    ]);
    expect(data.every((row) => row.id === row.documentId)).toBe(true);
  });

  it('drops published twins when the status filter is draft', () => {
    const { data, total } = assembleTransactionList(
      [draftOnly, draftTwin],
      [publishedTwin],
      { filter: { status: 'draft' } },
    );
    expect(total).toBe(1);
    expect(data[0]?.id).toBe('draft-only');
    expect(data[0]?.status).toBe('draft');
  });

  it('returns only published rows when the status filter is published', () => {
    const { data } = assembleTransactionList(
      [draftOnly, draftTwin],
      [publishedTwin],
      { filter: { status: 'published' } },
    );
    expect(data.map((row) => row.id)).toEqual(['both']);
  });

  it('sorts by createdAt independently of the booking date', () => {
    const rows: StrapiTransaction[] = [
      {
        documentId: 'later',
        date: '2026-01-01',
        createdAt: '2026-03-01T10:00:00.000Z',
      },
      {
        documentId: 'earlier',
        date: '2026-06-01',
        createdAt: '2026-01-02T08:00:00.000Z',
      },
    ];
    const { data } = assembleTransactionList([], rows, {
      sort: { field: 'createdAt', order: 'ASC' },
    });
    expect(data.map((row) => row.id)).toEqual(['earlier', 'later']);
  });

  it('sorts amounts numerically and paginates after the merge', () => {
    const rows: StrapiTransaction[] = [
      { documentId: 'a', date: '2026-01-01', amount: '9' },
      { documentId: 'b', date: '2026-01-02', amount: '10' },
      { documentId: 'c', date: '2026-01-03', amount: '2' },
    ];
    const { data, total } = assembleTransactionList([], rows, {
      sort: { field: 'amount', order: 'ASC' },
      pagination: { page: 2, perPage: 2 },
    });
    expect(total).toBe(3);
    expect(data.map((row) => row.id)).toEqual(['b']);
  });

  it('keeps a row only when the first receipt vendor contains the search', () => {
    const rows: StrapiTransaction[] = [
      {
        documentId: 'match',
        date: '2026-01-02',
        receipts: [{ vendor: '  Bolt  ' }, { vendor: 'Más' }],
      },
      {
        documentId: 'later-only',
        date: '2026-01-03',
        receipts: [{ vendor: 'Más' }, { vendor: 'Bolt' }],
      },
      {
        documentId: 'none',
        date: '2026-01-01',
        receipts: [],
      },
    ];
    const { data, total } = assembleTransactionList([], rows, {
      filter: { vendor: ' bol ' },
    });
    expect(total).toBe(1);
    expect(data.map((row) => row.id)).toEqual(['match']);
  });

  it('sorts by the first receipt vendor', () => {
    const rows: StrapiTransaction[] = [
      {
        documentId: 'z',
        date: '2026-01-01',
        receipts: [{ vendor: 'Zöldség' }],
      },
      { documentId: 'empty', date: '2026-01-02', receipts: [] },
      {
        documentId: 'a',
        date: '2026-01-03',
        receipts: [{ vendor: 'Alma' }, { vendor: 'Zöldség' }],
      },
    ];
    const { data } = assembleTransactionList([], rows, {
      sort: { field: 'vendor', order: 'ASC' },
    });
    expect(data.map((row) => row.id)).toEqual(['empty', 'a', 'z']);
  });

  it('ignores rows without a documentId', () => {
    const { data, total } = assembleTransactionList(
      [{ id: 9, description: 'no document' }],
      [],
      {},
    );
    expect(total).toBe(0);
    expect(data).toEqual([]);
  });
});

describe('firstReceiptVendor', () => {
  it('reads the first receipt vendor and leaves the rest empty', () => {
    expect(
      firstReceiptVendor([{ vendor: '  Bolt  ' }, { vendor: 'Más' }]),
    ).toBe('Bolt');
    expect(firstReceiptVendor([])).toBe('');
    expect(firstReceiptVendor(null)).toBe('');
    expect(firstReceiptVendor([{ vendor: null }])).toBe('');
  });
});

describe('buildTransactionFilters', () => {
  it('maps list filters onto Strapi filters and keeps status off the field query', () => {
    expect(
      buildTransactionFilters({
        status: 'draft',
        date_gte: '2026-01-01T00:00:00.000Z',
        date_lte: '2026-01-31',
        amount_gte: 1000,
        amount_lte: 1500,
        organization: 'org-1',
        debit_account: 'acc-debit',
        credit_account: 'acc-credit',
        description: '  kávé  ',
        vendor: '  Bolt  ',
      }),
    ).toEqual({
      status: 'draft',
      strapiFilters: {
        date: { $gte: '2026-01-01', $lte: '2026-01-31' },
        amount: { $gte: 1000, $lte: 1500 },
        organization: { documentId: { $eq: 'org-1' } },
        debit_account: { documentId: { $eq: 'acc-debit' } },
        credit_account: { documentId: { $eq: 'acc-credit' } },
        description: { $containsi: 'kávé' },
        receipts: { vendor: { $containsi: 'Bolt' } },
      },
    });
  });

  it('maps a createdAt day range onto a full UTC datetime window', () => {
    expect(
      buildTransactionFilters({
        createdAt_gte: '2026-02-01T00:00:00.000Z',
        createdAt_lte: '2026-02-15',
      }),
    ).toEqual({
      status: undefined,
      strapiFilters: {
        createdAt: {
          $gte: '2026-02-01T00:00:00.000Z',
          $lte: '2026-02-15T23:59:59.999Z',
        },
      },
    });
  });

  it('omits blank filters', () => {
    expect(
      buildTransactionFilters({
        status: '',
        description: '   ',
        vendor: '   ',
        amount_gte: '',
        amount_lte: null,
        organization: null,
      }),
    ).toEqual({ status: undefined, strapiFilters: {} });
  });
});

describe('encodeStrapiQuery', () => {
  it('encodes status and nested filters for the Content API', () => {
    const query = encodeStrapiQuery({
      populate: '*',
      status: 'draft',
      pagination: { page: 1, pageSize: 100 },
      filters: { date: { $gte: '2026-01-01' } },
    });
    const params = new URLSearchParams(query);
    expect(params.get('populate')).toBe('*');
    expect(params.get('status')).toBe('draft');
    expect(params.get('pagination[page]')).toBe('1');
    expect(params.get('pagination[pageSize]')).toBe('100');
    expect(params.get('filters[date][$gte]')).toBe('2026-01-01');
  });

  it('populates the receipt file along with the list relations', () => {
    const params = new URLSearchParams(
      encodeStrapiQuery({ populate: transactionPopulate }),
    );
    expect(params.get('populate[organization]')).toBe('true');
    expect(params.get('populate[debit_account]')).toBe('true');
    expect(params.get('populate[credit_account]')).toBe('true');
    expect(params.get('populate[currency_type][populate][icon][fields][0]')).toBe(
      'url',
    );
    expect(params.get('populate[currency_type][populate][icon][fields][1]')).toBe(
      'name',
    );
    expect(params.get('populate[currency_type][populate][icon][fields][2]')).toBe(
      'mime',
    );
    expect(params.get('populate[receipts][populate][document][fields][0]')).toBe(
      'url',
    );
    expect(params.get('populate[receipts][populate][document][fields][1]')).toBe(
      'name',
    );
    expect(params.get('populate[receipts][populate][document][fields][2]')).toBe(
      'mime',
    );
    expect(params.get('populate[receipts][populate][receipt_type]')).toBe('true');
  });
});

describe('preferTransaction', () => {
  it('keeps the published version when both rows exist', () => {
    const row = preferTransaction(
      { documentId: 'both', description: 'draft copy', entered_by: 'a@b.c' },
      {
        documentId: 'both',
        description: 'published copy',
        published_by: 'editor@b.c',
        publishedAt: '2026-04-01T12:00:00.000Z',
      },
    );
    expect(row?.status).toBe('published');
    expect(row?.id).toBe('both');
    expect(row?.description).toBe('published copy');
    expect(row?.published_by).toBe('editor@b.c');
  });

  it('keeps a draft when no published version exists', () => {
    const row = preferTransaction(
      { documentId: 'draft-only', entered_by: 'a@b.c' },
      null,
    );
    expect(row?.status).toBe('draft');
    expect(row?.entered_by).toBe('a@b.c');
    expect(row?.published_by).toBeUndefined();
  });
});

describe('loadTransactionRecord', () => {
  it('requests both statuses and prefers published', async () => {
    const calls: string[] = [];
    const row = await loadTransactionRecord(
      async (url) => {
        calls.push(url);
        const status = new URL(url).searchParams.get('status');
        return {
          json: {
            data: {
              documentId: 'doc-1',
              description: status,
              entered_by: 'a@b.c',
            },
          },
        };
      },
      'http://localhost:1337',
      'doc-1',
    );
    expect(calls).toHaveLength(2);
    expect(calls.every((url) => url.includes('/api/transactions/doc-1?'))).toBe(
      true,
    );
    const parsed = calls.map((url) => new URL(url).searchParams);
    expect(parsed.some((params) => params.get('status') === 'draft')).toBe(true);
    expect(parsed.some((params) => params.get('status') === 'published')).toBe(
      true,
    );
    expect(
      parsed.every(
        (params) =>
          params.get('populate[currency_type][populate][icon][fields][0]') ===
          'url',
      ),
    ).toBe(true);
    expect(row?.status).toBe('published');
    expect(row?.description).toBe('published');
  });

  it('treats a missing status as absent and throws other errors', async () => {
    const missing = await loadTransactionRecord(
      async (url) => {
        const status = new URL(url).searchParams.get('status');
        if (status === 'published') {
          const error = new Error('Not Found') as Error & { status: number };
          error.status = 404;
          throw error;
        }
        return { json: { data: { documentId: 'doc-1', description: 'draft' } } };
      },
      'http://localhost:1337',
      'doc-1',
    );
    expect(missing?.status).toBe('draft');

    await expect(
      loadTransactionRecord(
        async () => {
          const error = new Error('Nope') as Error & { status: number };
          error.status = 500;
          throw error;
        },
        'http://localhost:1337',
        'doc-1',
      ),
    ).rejects.toThrow('Nope');
  });
});
