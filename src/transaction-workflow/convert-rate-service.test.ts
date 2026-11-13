/**
 * Convert / preview service with apply_currency_rate (0002 plan §5.1–5.2):
 * rate lookup query + per-request cache, appliedRates in the result,
 * member ratio multiplier (rules[<currency code>]) + description audit,
 * 422 CURRENCY_RATE_MISSING / MEMBERSHIP_RATIO_AMBIGUOUS before any write,
 * preview movement.rate / movement.memberRatio.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ERROR_CURRENCY_RATE_MISSING,
  ERROR_MEMBERSHIP_RATIO_AMBIGUOUS,
  MEMBER_UID,
  STEP_MEMBER_CREDIT,
  STEP_MEMBER_DEBIT,
  STEP_RELATED,
  TRANSACTION_UID,
  TransactionWorkflowError,
  WORKFLOW_UID,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert.ts';
import {
  CURRENCY_RATE_UID,
  createRateResolver,
  findLatestCurrencyRate,
} from './convert-context.ts';
import { convertTransactions, type ConvertStrapi } from './convert-service.ts';
import { convertPreview, type PreviewStrapi } from './preview-service.ts';

const egg = { documentId: 'cur-egg', code: 'EGG' };
const huf = { documentId: 'cur-huf', code: 'HUF' };
const kor = { documentId: 'cur-kor', code: 'KOR' };
const henhouse = { documentId: 'org-tyuktartas' };

function account(code: string, documentId = `acc-${code}`) {
  return { documentId, code };
}

const memberPrivate = account('1001', 'acc-member-1001');
const memberAccount = account('1101', 'acc-member-1101');

const eggSaleWorkflow: WorkflowTemplate = {
  documentId: 'wf-24',
  name: 'Tojás eladás forintért',
  debit_account_code: 1001,
  credit_account_code: 1300,
  currency_type: egg,
  keep_original: true,
  steps_published: false,
  step: [
    {
      __component: STEP_MEMBER_DEBIT,
      description: 'Tojás eladás (tojás)',
      percent: 100,
      member_account_code: '1001',
      credit_account: account('1300'),
      currency_type: egg,
      organization: henhouse,
    },
    {
      __component: STEP_MEMBER_CREDIT,
      description: 'Tojás eladás (kp befizetés)',
      percent: 100,
      member_account_code: '1001',
      debit_account: account('1000'),
      currency_type: huf,
      organization: henhouse,
      apply_currency_rate: true,
    },
    {
      __component: STEP_RELATED,
      description: 'Tojás eladás (bevétel)',
      percent: 100,
      debit_account: account('4000'),
      credit_account: account('1000'),
      currency_type: huf,
      organization: henhouse,
      apply_currency_rate: true,
    },
  ],
};

function eggSource(documentId = 'tx-egg', amount = 30): SourceTransaction {
  return {
    documentId,
    date: '2026-11-07',
    amount,
    description: 'Tojás',
    debit_account: memberPrivate,
    credit_account: account('1300'),
    currency_type: egg,
  };
}

type RateRow = {
  documentId: string;
  rate: number;
  valid_from: string;
  from_currency_type: { documentId: string };
  to_currency_type: { documentId: string };
};

const eggHufRate: RateRow = {
  documentId: 'rate-egg-huf',
  rate: 100,
  valid_from: '2023-01-01T00:00:00.000Z',
  from_currency_type: { documentId: egg.documentId },
  to_currency_type: { documentId: huf.documentId },
};

const korHufRate: RateRow = {
  documentId: 'rate-kor-huf',
  rate: 600,
  valid_from: '2020-01-01T00:00:00.000Z',
  from_currency_type: { documentId: kor.documentId },
  to_currency_type: { documentId: huf.documentId },
};

type Fixture = {
  transactions: SourceTransaction[];
  rates?: RateRow[];
  memberships?: unknown[];
};

function buildStrapi(fixture: Fixture) {
  const writes: string[] = [];
  const created: {
    entered_key: string;
    amount: number;
    description: string;
  }[] = [];
  const rateQueries: Record<string, unknown>[] = [];
  let counter = 0;

  const transactionApi = {
    findOne: async ({ documentId }: { documentId: string }) =>
      fixture.transactions.find((row) => row.documentId === documentId) ?? null,
    findMany: async () => fixture.transactions,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      counter += 1;
      writes.push(`create:${String(data.entered_key)}`);
      created.push({
        entered_key: String(data.entered_key),
        amount: Number(data.amount),
        description: String(data.description ?? ''),
      });
      return { documentId: `created-${counter}` };
    },
    update: async ({ documentId }: { documentId: string }) => {
      writes.push(`update:${documentId}`);
      return {};
    },
    delete: async ({ documentId }: { documentId: string }) => {
      writes.push(`delete:${documentId}`);
      return {};
    },
    publish: async ({ documentId }: { documentId: string }) => {
      writes.push(`publish:${documentId}`);
      return {};
    },
    unpublish: async () => ({}),
  };

  const rateApi = {
    findMany: async (params: Record<string, unknown>) => {
      rateQueries.push(params);
      const filters = params.filters as {
        from_currency_type?: { documentId?: { $eq?: string } };
        to_currency_type?: { documentId?: { $eq?: string } };
      };
      const from = filters?.from_currency_type?.documentId?.$eq;
      const to = filters?.to_currency_type?.documentId?.$eq;
      return (fixture.rates ?? []).filter(
        (row) =>
          (!from || row.from_currency_type.documentId === from) &&
          (!to || row.to_currency_type.documentId === to),
      );
    },
  };

  const nullApi = { findOne: async () => null, findMany: async () => [] };

  const apis: Record<string, unknown> = {
    [TRANSACTION_UID]: transactionApi,
    [WORKFLOW_UID]: {
      findOne: async () => eggSaleWorkflow,
      findMany: async () => [eggSaleWorkflow],
    },
    [CURRENCY_RATE_UID]: rateApi,
    'api::account.account': nullApi,
    'api::currency-type.currency-type': nullApi,
  };

  const strapi = {
    documents: (uid: string) => {
      const api = apis[uid];
      if (!api) throw new Error(`Unexpected documents uid in test: ${uid}`);
      return api;
    },
    db: {
      query: (uid: string) => ({
        findOne: async () =>
          uid === MEMBER_UID
            ? {
                account: memberAccount,
                private_account: memberPrivate,
                memberships: fixture.memberships ?? [],
              }
            : null,
      }),
    },
    requestContext: { get: () => ({ state: {} }) },
    log: { warn: () => {} },
  };

  return { strapi, writes, created, rateQueries };
}

async function rejectsWithCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof TransactionWorkflowError);
    assert.equal(error.status, 422);
    assert.equal(error.code, code);
    return true;
  });
}

describe('findLatestCurrencyRate / createRateResolver', () => {
  it('queries the direct pair up to the end of the source day, newest first', async () => {
    const { strapi, rateQueries } = buildStrapi({
      transactions: [],
      rates: [eggHufRate],
    });
    const found = await findLatestCurrencyRate(strapi, {
      fromCurrencyDocumentId: egg.documentId,
      toCurrencyDocumentId: huf.documentId,
      date: '2026-11-07',
    });
    assert.equal(found?.rate, 100);
    assert.equal(found?.currencyRateDocumentId, 'rate-egg-huf');
    assert.deepEqual(rateQueries[0].filters, {
      from_currency_type: { documentId: { $eq: 'cur-egg' } },
      to_currency_type: { documentId: { $eq: 'cur-huf' } },
      valid_from: { $lte: '2026-11-07T23:59:59.999Z' },
    });
    assert.deepEqual(rateQueries[0].sort, ['valid_from:desc']);
  });

  it('skips the DB for the same currency', async () => {
    const { strapi, rateQueries } = buildStrapi({ transactions: [] });
    const found = await findLatestCurrencyRate(strapi, {
      fromCurrencyDocumentId: huf.documentId,
      toCurrencyDocumentId: huf.documentId,
      date: '2026-11-07',
    });
    assert.equal(found?.rate, 1);
    assert.equal(rateQueries.length, 0);
  });

  it('caches per pair and day', async () => {
    const { strapi, rateQueries } = buildStrapi({
      transactions: [],
      rates: [eggHufRate],
    });
    const resolve = createRateResolver(strapi);
    await resolve('cur-egg', 'cur-huf', '2026-11-07');
    await resolve('cur-egg', 'cur-huf', '2026-11-07T10:00:00.000Z');
    await resolve('cur-egg', 'cur-huf', '2026-11-08');
    assert.equal(rateQueries.length, 2);
  });

  it('inverts KOR → HUF when HUF → KOR is missing', async () => {
    const { strapi, rateQueries } = buildStrapi({
      transactions: [],
      rates: [korHufRate],
    });
    const found = await findLatestCurrencyRate(strapi, {
      fromCurrencyDocumentId: huf.documentId,
      toCurrencyDocumentId: kor.documentId,
      date: '2026-11-07',
      fromCode: 'HUF',
      toCode: 'KOR',
    });
    assert.equal(found?.rate, 1 / 600);
    assert.equal(found?.inverted, true);
    assert.equal(found?.currencyRateDocumentId, 'rate-kor-huf');
    assert.equal(rateQueries.length, 2);
  });

  it('does not invert non-KOR pairs when the direct row is missing', async () => {
    const { strapi, rateQueries } = buildStrapi({
      transactions: [],
      rates: [
        {
          documentId: 'rate-huf-egg',
          rate: 0.01,
          valid_from: '2020-01-01T00:00:00.000Z',
          from_currency_type: { documentId: huf.documentId },
          to_currency_type: { documentId: egg.documentId },
        },
      ],
    });
    const found = await findLatestCurrencyRate(strapi, {
      fromCurrencyDocumentId: egg.documentId,
      toCurrencyDocumentId: huf.documentId,
      date: '2026-11-07',
      fromCode: 'EGG',
      toCode: 'HUF',
    });
    assert.equal(found, null);
    assert.equal(rateQueries.length, 1);
  });
});

describe('convertTransactions with apply_currency_rate', () => {
  it('books 30 EGG → 3 000 HUF and reports appliedRates', async () => {
    const { strapi, created, rateQueries } = buildStrapi({
      transactions: [eggSource()],
      rates: [eggHufRate],
    });
    const [result] = await convertTransactions(
      strapi as unknown as ConvertStrapi,
      { transactionDocumentId: 'tx-egg' },
    );
    assert.deepEqual(
      created.map((row) => [row.entered_key, row.amount]),
      [
        ['tx-egg:storno', -30],
        ['tx-egg:step:0', 30],
        ['tx-egg:step:1', 3000],
        ['tx-egg:step:2', 3000],
      ],
    );
    assert.deepEqual(
      result.appliedRates.map((row) => [row.stepIndex, row.rate]),
      [
        [1, 100],
        [2, 100],
      ],
    );
    // Two HUF steps share one lookup.
    assert.equal(rateQueries.length, 1);
  });

  it('one lookup for a batch of same-day rows', async () => {
    const { strapi, rateQueries } = buildStrapi({
      transactions: [eggSource('tx-a'), eggSource('tx-b', 12)],
      rates: [eggHufRate],
    });
    const results = await convertTransactions(
      strapi as unknown as ConvertStrapi,
      { workflowDocumentId: 'wf-24' },
    );
    assert.equal(results.length, 2);
    assert.equal(rateQueries.length, 1);
  });

  it('missing rate → 422 CURRENCY_RATE_MISSING and no writes', async () => {
    const { strapi, writes } = buildStrapi({
      transactions: [eggSource()],
      rates: [],
    });
    await rejectsWithCode(
      convertTransactions(strapi as unknown as ConvertStrapi, {
        transactionDocumentId: 'tx-egg',
      }),
      ERROR_CURRENCY_RATE_MISSING,
    );
    assert.deepEqual(writes, []);
  });

  it('multiplies HUF steps by the member ratio and records it', async () => {
    const { strapi, created } = buildStrapi({
      transactions: [eggSource('tx-egg', 20)],
      rates: [eggHufRate],
      memberships: [
        {
          documentId: 'm-1',
          membership_type: {
            name: 'Érdeklődő',
            rules: { egg: { mode: 'sale', ratio: 0.75 } },
          },
        },
      ],
    });
    const [result] = await convertTransactions(
      strapi as unknown as ConvertStrapi,
      { transactionDocumentId: 'tx-egg' },
    );
    assert.deepEqual(
      created.map((row) => [row.entered_key, row.amount, row.description]),
      [
        ['tx-egg:storno', -20, 'Tojás'],
        ['tx-egg:step:0', 20, 'Tojás eladás (tojás)'],
        [
          'tx-egg:step:1',
          1500,
          'Tojás eladás (kp befizetés) · ratio 0.75 (Érdeklődő)',
        ],
        [
          'tx-egg:step:2',
          1500,
          'Tojás eladás (bevétel) · ratio 0.75 (Érdeklődő)',
        ],
      ],
    );
    assert.deepEqual(
      result.appliedRates.map((row) => [
        row.stepIndex,
        row.rate,
        row.ratio,
        row.membershipDocumentId,
      ]),
      [
        [1, 100, 0.75, 'm-1'],
        [2, 100, 0.75, 'm-1'],
      ],
    );
  });

  it('mode internal is executed (ratio still applies)', async () => {
    const { strapi, created } = buildStrapi({
      transactions: [eggSource()],
      rates: [eggHufRate],
      memberships: [{ rules: { egg: { mode: 'internal', ratio: 1 } } }],
    });
    await convertTransactions(strapi as unknown as ConvertStrapi, {
      transactionDocumentId: 'tx-egg',
    });
    assert.deepEqual(
      created.map((row) => row.amount),
      [-30, 30, 3000, 3000],
    );
  });

  it('ambiguous ratios → 422 MEMBERSHIP_RATIO_AMBIGUOUS and no writes', async () => {
    const { strapi, writes } = buildStrapi({
      transactions: [eggSource()],
      rates: [eggHufRate],
      memberships: [
        { name: 'Tyúktartás', rules: { egg: { ratio: 1 } } },
        { name: 'Más projekt', rules: { egg: { ratio: 0.75 } } },
      ],
    });
    await rejectsWithCode(
      convertTransactions(strapi as unknown as ConvertStrapi, {
        transactionDocumentId: 'tx-egg',
      }),
      ERROR_MEMBERSHIP_RATIO_AMBIGUOUS,
    );
    assert.deepEqual(writes, []);
  });

  it('no membership rule for the currency → ratio 1', async () => {
    const { strapi, created } = buildStrapi({
      transactions: [eggSource()],
      rates: [eggHufRate],
      memberships: [
        { documentId: 'm-ok', membership_type: { name: 'Vásárló' } },
      ],
    });
    const [result] = await convertTransactions(
      strapi as unknown as ConvertStrapi,
      { transactionDocumentId: 'tx-egg' },
    );
    assert.equal(created[2].amount, 3000);
    assert.equal(result.appliedRates[0].ratio, 1);
    assert.equal(result.appliedRates[0].membershipDocumentId, null);
  });
});

describe('convertPreview with apply_currency_rate', () => {
  it('exposes movement.rate on flagged steps only', async () => {
    const { strapi } = buildStrapi({
      transactions: [eggSource()],
      rates: [eggHufRate],
    });
    const preview = await convertPreview(strapi as unknown as PreviewStrapi, {
      transactionDocumentId: 'tx-egg',
    });
    assert.deepEqual(
      preview.movements.map((row) => [
        row.kind,
        row.amount,
        row.rate?.rate ?? null,
      ]),
      [
        ['storno', -30, null],
        ['step', 30, null],
        ['step', 3000, 100],
        ['step', 3000, 100],
      ],
    );
    assert.ok(preview.movements.every((row) => row.memberRatio === null));
  });

  it('shows the multiplied amount and memberRatio on HUF steps', async () => {
    const { strapi } = buildStrapi({
      transactions: [eggSource()],
      rates: [eggHufRate],
      memberships: [
        {
          documentId: 'm-1',
          name: 'Kedvezményes',
          rules: { egg: { mode: 'sale', ratio: 0.5 } },
        },
      ],
    });
    const preview = await convertPreview(strapi as unknown as PreviewStrapi, {
      transactionDocumentId: 'tx-egg',
    });
    assert.deepEqual(
      preview.movements.map((row) => [
        row.amount,
        row.memberRatio?.ratio ?? null,
      ]),
      [
        [-30, null],
        [30, null],
        [1500, 0.5],
        [1500, 0.5],
      ],
    );
    assert.equal(
      preview.movements[2].description,
      'Tojás eladás (kp befizetés) · ratio 0.5 (Kedvezményes)',
    );
  });

  it('ambiguous ratios → 422 in preview too', async () => {
    const { strapi } = buildStrapi({
      transactions: [eggSource()],
      rates: [eggHufRate],
      memberships: [
        { rules: { egg: { ratio: 1 } } },
        { rules: { egg: { ratio: 0.5 } } },
      ],
    });
    await rejectsWithCode(
      convertPreview(strapi as unknown as PreviewStrapi, {
        transactionDocumentId: 'tx-egg',
      }),
      ERROR_MEMBERSHIP_RATIO_AMBIGUOUS,
    );
  });

  it('missing rate → 422 CURRENCY_RATE_MISSING (same as Convert)', async () => {
    const { strapi } = buildStrapi({ transactions: [eggSource()], rates: [] });
    await rejectsWithCode(
      convertPreview(strapi as unknown as PreviewStrapi, {
        transactionDocumentId: 'tx-egg',
      }),
      ERROR_CURRENCY_RATE_MISSING,
    );
  });
});
