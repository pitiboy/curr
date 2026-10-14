import { describe, expect, it } from 'vitest';

import {
  assembleTransactionList,
  buildTransactionFilters,
  encodeStrapiQuery,
  type StrapiTransaction,
} from './transactionList';

const draftOnly: StrapiTransaction = {
  id: 1,
  documentId: 'draft-only',
  date: '2026-02-01',
  amount: '10.00',
  description: 'piszkozat',
  organization: { documentId: 'org-1', name: 'Kör' },
  receipt: null,
};

const publishedTwin: StrapiTransaction = {
  id: 2,
  documentId: 'both',
  date: '2026-01-15',
  amount: '9',
  description: 'published copy',
  receipt: { documentId: 'receipt-1' },
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

describe('buildTransactionFilters', () => {
  it('maps list filters onto Strapi filters and keeps status off the field query', () => {
    expect(
      buildTransactionFilters({
        status: 'draft',
        date_gte: '2026-01-01T00:00:00.000Z',
        date_lte: '2026-01-31',
        amount: 1500,
        organization: 'org-1',
        debit_account: 'acc-debit',
        credit_account: 'acc-credit',
        description: '  kávé  ',
      }),
    ).toEqual({
      status: 'draft',
      strapiFilters: {
        date: { $gte: '2026-01-01', $lte: '2026-01-31' },
        amount: { $eq: 1500 },
        organization: { documentId: { $eq: 'org-1' } },
        debit_account: { documentId: { $eq: 'acc-debit' } },
        credit_account: { documentId: { $eq: 'acc-credit' } },
        description: { $containsi: 'kávé' },
      },
    });
  });

  it('omits blank filters', () => {
    expect(
      buildTransactionFilters({
        status: '',
        description: '   ',
        amount: '',
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
});
