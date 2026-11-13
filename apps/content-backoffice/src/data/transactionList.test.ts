import { describe, expect, it } from 'vitest';

import {
  accountCodeMatchesPattern,
  assembleTransactionList,
  buildTransactionFilters,
  PROJECT_BALANCE_LEG_FILTER_KEY,
  CREDIT_ACCOUNT_IN_FILTER_KEY,
  MEMBERSHIP_LEDGER_MODE_FILTER_KEY,
  MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY,
  MEMBER_LEDGER_ACCOUNT_IN_FILTER_KEY,
  RECEIPT_PRESENCE_FILTER_KEY,
  encodeStrapiQuery,
  firstReceiptVendor,
  isExactAccountCodePattern,
  parseTransactionAmount,
  pickMatchingWorkflow,
  sumTransactionAmountsByCurrency,
  preferTransaction,
  transactionPopulate,
  workflowMatchesTransaction,
  type StrapiTransaction,
  type WorkflowTemplateHeader,
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
      ['both', 'published', 'both'],
      ['draft-only', 'draft', 'draft-only'],
    ]);
    expect(data.every((row) => row.id === row.documentId)).toBe(true);
    expect(data.map((row) => row.entryId)).toEqual([2, 1]);
  });

  it('defaults sort to entryId DESC', () => {
    const { data } = assembleTransactionList(
      [
        { id: 10, documentId: 'low', date: '2026-06-01' },
        { id: 30, documentId: 'high', date: '2026-01-01' },
      ],
      [],
      {},
    );
    expect(data.map((row) => row.documentId)).toEqual(['high', 'low']);
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

  it('filters published rows without receipts for reconciliation drill-down', () => {
    const noReceipt: StrapiTransaction = {
      id: 4,
      documentId: 'pub-empty',
      date: '2026-01-20',
      amount: '1',
      description: 'none',
      receipts: [],
    };
    const { data, total } = assembleTransactionList(
      [],
      [publishedTwin, noReceipt],
      {
        filter: {
          status: 'published',
          [RECEIPT_PRESENCE_FILTER_KEY]: 'none',
        },
      },
    );
    expect(total).toBe(1);
    expect(data[0]?.documentId).toBe('pub-empty');
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

  it('filters membership-share external payments on the client', () => {
    const rows: StrapiTransaction[] = [
      {
        documentId: 'ext',
        date: '2026-01-01',
        debit_account: { code: '1000' },
        credit_account: { code: '1101', documentId: 'acc-a' },
      },
      {
        documentId: 'int',
        date: '2026-01-02',
        debit_account: { code: '1001', documentId: 'acc-b' },
        credit_account: { code: '1101', documentId: 'acc-a' },
      },
    ];
    const { data } = assembleTransactionList([], rows, {
      filter: { [MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY]: true },
    });
    expect(data.map((row) => row.id)).toEqual(['ext']);
  });

  it('filters membership-ledger deduction mode (ignores 3000 and 5xx wash)', () => {
    const rows: StrapiTransaction[] = [
      {
        documentId: 'real-out',
        date: '2026-01-01',
        debit_account: { code: '1001', documentId: 'acc-p' },
        credit_account: { code: '1720' },
      },
      {
        documentId: 'wash',
        date: '2026-01-02',
        debit_account: { code: '1001', documentId: 'acc-p' },
        credit_account: { code: '5510' },
      },
      {
        documentId: 'equity',
        date: '2026-01-03',
        debit_account: { code: '1101', documentId: 'acc-s' },
        credit_account: { code: '3000' },
      },
    ];
    const { data } = assembleTransactionList([], rows, {
      filter: { [MEMBERSHIP_LEDGER_MODE_FILTER_KEY]: 'deduction' },
    });
    expect(data.map((row) => row.id)).toEqual(['real-out']);
  });

  it('builds Strapi $or for member_ledger_account_in', () => {
    const { strapiFilters } = buildTransactionFilters({
      [MEMBER_LEDGER_ACCOUNT_IN_FILTER_KEY]: ['acc-a'],
      converted_to_workflow: ['none'],
    });
    expect(strapiFilters).toMatchObject({
      converted_to_workflow: { $null: true },
      $or: [
        { credit_account: { documentId: { $eq: 'acc-a' } } },
        { debit_account: { documentId: { $eq: 'acc-a' } } },
      ],
    });
  });

  it('excludes kincstári KOR clearing from membership-share external filter', () => {
    const rows: StrapiTransaction[] = [
      {
        documentId: 'lock',
        date: '2026-01-01',
        currency_type: { code: 'KOR' },
        debit_account: { code: '1510' },
        credit_account: { code: '1101', documentId: 'acc-a' },
      },
      {
        documentId: 'treasury-out',
        date: '2026-01-02',
        currency_type: { code: 'KOR' },
        debit_account: { code: '1900' },
        credit_account: { code: '1101', documentId: 'acc-a' },
      },
      {
        documentId: 'treasury-in',
        date: '2026-01-03',
        currency_type: { code: 'KOR' },
        debit_account: { code: '1101', documentId: 'acc-a' },
        credit_account: { code: '1900' },
      },
      {
        documentId: 'huf-fedezet',
        date: '2026-01-04',
        currency_type: { code: 'HUF' },
        debit_account: { code: '1900' },
        credit_account: { code: '1520' },
      },
    ];
    const { data } = assembleTransactionList([], rows, {
      filter: { [MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY]: true },
    });
    expect(data.map((row) => row.id)).toEqual(['lock', 'huf-fedezet']);
  });

  it('filters by project balance leg using account classification', () => {
    const rows: StrapiTransaction[] = [
      {
        documentId: 'rev',
        date: '2026-01-01',
        debit_account: { code: '1200' },
        credit_account: { code: '4000' },
      },
      {
        documentId: 'cost',
        date: '2026-01-02',
        debit_account: { code: '5200' },
        credit_account: { code: '1100' },
      },
    ];
    const { data: revenueOnly } = assembleTransactionList([], rows, {
      filter: { [PROJECT_BALANCE_LEG_FILTER_KEY]: 'revenue' },
    });
    expect(revenueOnly.map((row) => row.id)).toEqual(['rev']);
    const { data: costOnly } = assembleTransactionList([], rows, {
      filter: { [PROJECT_BALANCE_LEG_FILTER_KEY]: 'cost' },
    });
    expect(costOnly.map((row) => row.id)).toEqual(['cost']);
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

describe('sumTransactionAmountsByCurrency', () => {
  it('groups by currency code on the current page slice', () => {
    expect(
      sumTransactionAmountsByCurrency([
        { amount: '1000', currency_type: { code: 'HUF' } },
        { amount: 500, currency_type: { code: 'HUF' } },
        { amount: '2.5', currency_type: { code: 'EUR' } },
      ]),
    ).toEqual([
      { currency: 'EUR', amount: 2.5 },
      { currency: 'HUF', amount: 1500 },
    ]);
  });

  it('parses comma decimals', () => {
    expect(parseTransactionAmount('1,5')).toBe(1.5);
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
        currency_type: 'HUF',
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
        currency_type: { code: { $eq: 'HUF' } },
        debit_account: { documentId: { $eq: 'acc-debit' } },
        credit_account: { documentId: { $eq: 'acc-credit' } },
        description: { $containsi: 'kávé' },
        receipts: { vendor: { $containsi: 'Bolt' } },
        $or: [
          { converted_to_workflow: { $null: true } },
          { converted_to_workflow: { $eq: 'expanded' } },
        ],
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
        $or: [
          { converted_to_workflow: { $null: true } },
          { converted_to_workflow: { $eq: 'expanded' } },
        ],
      },
    });
  });

  it('accepts status as a one-element array from a stale list URL', () => {
    expect(buildTransactionFilters({ status: ['draft'] }).status).toBe('draft');
    expect(buildTransactionFilters({ status: ['published'] }).status).toBe(
      'published',
    );
  });

  it('omits blank filters but keeps the default converted filter', () => {
    expect(
      buildTransactionFilters({
        status: '',
        description: '   ',
        vendor: '   ',
        amount_gte: '',
        amount_lte: null,
        organization: null,
        converted_to_workflow: '',
      }),
    ).toEqual({
      status: undefined,
      strapiFilters: {
        $or: [
          { converted_to_workflow: { $null: true } },
          { converted_to_workflow: { $eq: 'expanded' } },
        ],
      },
    });
  });

  it('maps credit_account_in and credit_account_code for membership drill-down', () => {
    expect(
      buildTransactionFilters({
        [CREDIT_ACCOUNT_IN_FILTER_KEY]: ['acc-a', 'acc-b'],
        credit_account_code: '1101',
      }),
    ).toEqual({
      status: undefined,
      strapiFilters: {
        credit_account: { documentId: { $in: ['acc-a', 'acc-b'] } },
        $or: [
          { converted_to_workflow: { $null: true } },
          { converted_to_workflow: { $eq: 'expanded' } },
        ],
      },
    });
    expect(
      buildTransactionFilters({ credit_account_code: '1101' }),
    ).toMatchObject({
      strapiFilters: {
        credit_account: { code: { $eq: '1101' } },
      },
    });
  });

  it('maps converted_to_workflow multiselect to null / enum clauses', () => {
    expect(
      buildTransactionFilters({ converted_to_workflow: ['none', 'expanded'] }),
    ).toEqual({
      status: undefined,
      strapiFilters: {
        $or: [
          { converted_to_workflow: { $null: true } },
          { converted_to_workflow: { $eq: 'expanded' } },
        ],
      },
    });
    expect(
      buildTransactionFilters({ converted_to_workflow: 'original' }),
    ).toEqual({
      status: undefined,
      strapiFilters: { converted_to_workflow: { $eq: 'original' } },
    });
    expect(
      buildTransactionFilters({
        converted_to_workflow: ['original', 'expanded'],
      }),
    ).toEqual({
      status: undefined,
      strapiFilters: {
        converted_to_workflow: { $in: ['original', 'expanded'] },
      },
    });
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
    expect(
      params.get('populate[currency_type][populate][icon][fields][0]'),
    ).toBe('url');
    expect(
      params.get('populate[currency_type][populate][icon][fields][1]'),
    ).toBe('name');
    expect(
      params.get('populate[currency_type][populate][icon][fields][2]'),
    ).toBe('mime');
    expect(
      params.get('populate[receipts][populate][document][fields][0]'),
    ).toBe('url');
    expect(
      params.get('populate[receipts][populate][document][fields][1]'),
    ).toBe('name');
    expect(
      params.get('populate[receipts][populate][document][fields][2]'),
    ).toBe('mime');
    expect(params.get('populate[receipts][populate][receipt_type]')).toBe(
      'true',
    );
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

const ugyelet1Template: WorkflowTemplateHeader = {
  documentId: 'wf-1',
  name: 'Ügylet 1',
  debit_account_code: 1520,
  credit_account_code: 1101,
  requires_source_organization: false,
};

describe('workflowMatchesTransaction', () => {
  it('matches debit/credit codes when not converted', () => {
    expect(
      workflowMatchesTransaction(ugyelet1Template, {
        debit_account: { code: '1520' },
        credit_account: { code: '1101' },
      }),
    ).toBe(true);
  });

  it('rejects original, expanded, and storno rows', () => {
    expect(
      workflowMatchesTransaction(ugyelet1Template, {
        debit_account: { code: '1520' },
        credit_account: { code: '1101' },
        converted_to_workflow: 'original',
      }),
    ).toBe(false);
    expect(
      workflowMatchesTransaction(ugyelet1Template, {
        debit_account: { code: '1520' },
        credit_account: { code: '1101' },
        converted_to_workflow: 'expanded',
      }),
    ).toBe(false);
    expect(
      workflowMatchesTransaction(ugyelet1Template, {
        debit_account: { code: '1520' },
        credit_account: { code: '1101' },
        converted_to_workflow: 'storno',
      }),
    ).toBe(false);
  });

  it('requires currency when the template specifies one', () => {
    const korTemplate: WorkflowTemplateHeader = {
      ...ugyelet1Template,
      currency_type: { documentId: 'cur-kor' },
    };
    expect(
      workflowMatchesTransaction(korTemplate, {
        debit_account: { code: '1520' },
        credit_account: { code: '1101' },
        currency_type: { documentId: 'cur-huf' },
      }),
    ).toBe(false);
    expect(
      workflowMatchesTransaction(korTemplate, {
        debit_account: { code: '1520' },
        credit_account: { code: '1101' },
        currency_type: { documentId: 'cur-kor' },
      }),
    ).toBe(true);
  });

  it('matches glob and regex header patterns', () => {
    expect(accountCodeMatchesPattern('1520', '15?0')).toBe(true);
    expect(accountCodeMatchesPattern('10', '15?0')).toBe(false);
    expect(accountCodeMatchesPattern('1520', '15[23]0')).toBe(true);
    expect(accountCodeMatchesPattern('1510', '15[23]0')).toBe(false);
    expect(isExactAccountCodePattern('1520')).toBe(true);
    expect(isExactAccountCodePattern('15*')).toBe(false);
    expect(
      workflowMatchesTransaction(
        {
          ...ugyelet1Template,
          debit_account_code: '15[23]0',
        },
        {
          debit_account: { code: '1520' },
          credit_account: { code: '1101' },
        },
      ),
    ).toBe(true);
  });

  it('matches kor részjegy project pattern and requires type', () => {
    const pattern = '(5(00|10|4[0-9]|50|80)0|15[0-9]0)';
    expect(accountCodeMatchesPattern('1510', pattern)).toBe(true);
    expect(accountCodeMatchesPattern('1520', pattern)).toBe(true);
    expect(accountCodeMatchesPattern('5410', pattern)).toBe(true);
    expect(accountCodeMatchesPattern('5200', pattern)).toBe(false);
    const template: WorkflowTemplateHeader = {
      documentId: 'wf-resz',
      name: 'Tagi befizetés projekt vagy ingatlanba lekötéssel',
      debit_account_code: pattern,
      credit_account_code: '1101',
      transaction_type: { documentId: 'type-resz', name: 'Részjegy' },
      requires_source_organization: true,
    };
    const lekot: WorkflowTemplateHeader = {
      documentId: 'wf-lekot',
      name: 'Tagi lekötés gazdasági ingatlanba',
      debit_account_code: '15[12]0',
      credit_account_code: '1101',
      transaction_type: { documentId: 'type-lekot', name: 'Lekötés' },
      requires_source_organization: false,
    };
    const tx = {
      debit_account: { code: '1510' },
      credit_account: { code: '1101' },
      transaction_type: { documentId: 'type-resz', name: 'Részjegy' },
    };
    expect(workflowMatchesTransaction(template, tx)).toBe(true);
    expect(workflowMatchesTransaction(lekot, tx)).toBe(false);
    expect(pickMatchingWorkflow([template, lekot], tx)?.documentId).toBe(
      'wf-resz',
    );
    expect(
      workflowMatchesTransaction(template, {
        ...tx,
        transaction_type: 'type-resz',
      }),
    ).toBe(true);
    expect(
      workflowMatchesTransaction(template, {
        ...tx,
        transaction_type: null,
      }),
    ).toBe(false);
  });
});

describe('pickMatchingWorkflow', () => {
  it('returns the sole matching template', () => {
    expect(
      pickMatchingWorkflow([ugyelet1Template], {
        debit_account: { code: 1520 },
        credit_account: { code: 1101 },
      }),
    ).toEqual(ugyelet1Template);
  });

  it('returns null when no template matches or more than one matches', () => {
    const twin: WorkflowTemplateHeader = {
      ...ugyelet1Template,
      documentId: 'wf-2',
    };
    expect(
      pickMatchingWorkflow([ugyelet1Template], {
        debit_account: { code: '9999' },
        credit_account: { code: '1101' },
      }),
    ).toBeNull();
    expect(
      pickMatchingWorkflow([ugyelet1Template, twin], {
        debit_account: { code: '1520' },
        credit_account: { code: '1101' },
      }),
    ).toBeNull();
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
    expect(parsed.some((params) => params.get('status') === 'draft')).toBe(
      true,
    );
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
        return {
          json: { data: { documentId: 'doc-1', description: 'draft' } },
        };
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
