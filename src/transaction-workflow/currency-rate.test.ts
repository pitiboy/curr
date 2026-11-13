/**
 * apply_currency_rate (0002 plan §5.1): pickLatestRate, stepsNeedingRate,
 * expandWorkflowSteps with rates — Tojás eladás forintért (24) fixture,
 * flag-free KOR regression, missing / invalid rate 422, rounding.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ERROR_CURRENCY_RATE_INVALID,
  ERROR_CURRENCY_RATE_MISSING,
  STEP_MEMBER_CREDIT,
  STEP_MEMBER_DEBIT,
  STEP_RELATED,
  TransactionWorkflowError,
  expandWorkflowSteps,
  pickLatestRate,
  stepsNeedingRate,
  type AppliedRate,
  type CurrencyRateRow,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert.ts';

const egg = { documentId: 'cur-egg', code: 'EGG' };
const huf = { documentId: 'cur-huf', code: 'HUF' };
const kor = { documentId: 'cur-kor', code: 'KOR' };
const henhouse = { documentId: 'org-tyuktartas' };

function account(code: string, documentId = `acc-${code}`) {
  return { documentId, code };
}

const memberPrivate = account('1001', 'acc-member-1001');

/** database/seeders/http/edizone/data/transaction-workflows/24-tojas-eladas-forint.json */
const eggSaleWorkflow: WorkflowTemplate = {
  documentId: 'wf-24',
  name: 'Tojás eladás forintért',
  debit_account_code: 1001,
  credit_account_code: 1300,
  currency_type: egg,
  keep_original: true,
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

const eggSource: SourceTransaction = {
  documentId: 'tx-egg',
  date: '2026-11-07',
  amount: 30,
  description: 'Tojás',
  debit_account: memberPrivate,
  credit_account: account('1300'),
  currency_type: egg,
};

function rate(
  value: number,
  validFrom = '2023-01-01T00:00:00.000Z',
): AppliedRate {
  return {
    fromCurrencyDocumentId: egg.documentId,
    toCurrencyDocumentId: huf.documentId,
    rate: value,
    validFrom,
    currencyRateDocumentId: 'rate-egg-huf',
    inverted: false,
  };
}

function rows(
  ...entries: [string, string, number, string, string?][]
): CurrencyRateRow[] {
  return entries.map(([from, to, value, validFrom, documentId]) => ({
    documentId: documentId ?? `${from}-${to}-${validFrom}`,
    rate: value,
    valid_from: validFrom,
    fromCurrencyDocumentId: from,
    toCurrencyDocumentId: to,
  }));
}

function assertWorkflowError(
  fn: () => unknown,
  code: string,
): TransactionWorkflowError {
  let caught: unknown;
  assert.throws(fn, (error: unknown) => {
    caught = error;
    return error instanceof TransactionWorkflowError;
  });
  const error = caught as TransactionWorkflowError;
  assert.equal(error.status, 422);
  assert.equal(error.code, code);
  return error;
}

describe('pickLatestRate', () => {
  const history = rows(
    ['cur-egg', 'cur-huf', 80, '2023-01-01T00:00:00.000Z', 'old'],
    ['cur-egg', 'cur-huf', 100, '2026-11-01T00:00:00.000Z', 'nov'],
    ['cur-egg', 'cur-huf', 120, '2026-11-07T18:30:00.000Z', 'same-day'],
    ['cur-egg', 'cur-huf', 150, '2026-11-08T00:00:00.000Z', 'future'],
    ['cur-huf', 'cur-egg', 0.01, '2026-11-01T00:00:00.000Z', 'inverse'],
  );

  it('picks the latest row up to the end of the day, inclusive', () => {
    const picked = pickLatestRate(history, 'cur-egg', 'cur-huf', '2026-11-07');
    assert.equal(picked?.rate, 120);
    assert.equal(picked?.currencyRateDocumentId, 'same-day');
  });

  it('excludes rows that start after the date', () => {
    assert.equal(
      pickLatestRate(history, 'cur-egg', 'cur-huf', '2026-11-06')?.rate,
      100,
    );
  });

  it('accepts a full ISO timestamp as the date', () => {
    assert.equal(
      pickLatestRate(history, 'cur-egg', 'cur-huf', '2026-11-08T05:00:00.000Z')
        ?.rate,
      150,
    );
  });

  it('returns null without a direct pair for non-KOR currencies', () => {
    assert.equal(
      pickLatestRate(history, 'cur-egg', 'cur-kor', '2026-11-07'),
      null,
    );
    assert.equal(
      pickLatestRate(
        rows(['cur-huf', 'cur-egg', 0.01, '2020-01-01T00:00:00.000Z']),
        'cur-egg',
        'cur-huf',
        '2026-11-07',
        { fromCode: 'EGG', toCode: 'HUF' },
      ),
      null,
    );
  });

  it('inverts KOR → HUF when HUF → KOR is missing', () => {
    const picked = pickLatestRate(
      rows(['cur-kor', 'cur-huf', 600, '2020-01-01T00:00:00.000Z', 'kor-huf']),
      huf.documentId,
      kor.documentId,
      '2026-11-07',
      { fromCode: 'HUF', toCode: 'KOR' },
    );
    assert.deepEqual(picked, {
      fromCurrencyDocumentId: huf.documentId,
      toCurrencyDocumentId: kor.documentId,
      rate: 1 / 600,
      validFrom: '2020-01-01T00:00:00.000Z',
      currencyRateDocumentId: 'kor-huf',
      inverted: true,
    });
  });

  it('prefers a direct HUF → KOR row over the inverse', () => {
    const picked = pickLatestRate(
      rows(
        ['cur-kor', 'cur-huf', 600, '2020-01-01T00:00:00.000Z', 'kor-huf'],
        ['cur-huf', 'cur-kor', 0.002, '2020-01-01T00:00:00.000Z', 'huf-kor'],
      ),
      huf.documentId,
      kor.documentId,
      '2026-11-07',
      { fromCode: 'HUF', toCode: 'KOR' },
    );
    assert.equal(picked?.rate, 0.002);
    assert.equal(picked?.inverted, false);
    assert.equal(picked?.currencyRateDocumentId, 'huf-kor');
  });

  it('does not invert a non-KOR pair even when codes are set', () => {
    assert.equal(
      pickLatestRate(
        rows(['cur-huf', 'cur-egg', 0.01, '2020-01-01T00:00:00.000Z']),
        egg.documentId,
        huf.documentId,
        '2026-11-07',
        { fromCode: 'EGG', toCode: 'HUF' },
      ),
      null,
    );
  });

  it('returns null before the first row', () => {
    assert.equal(
      pickLatestRate(history, 'cur-egg', 'cur-huf', '2022-12-31'),
      null,
    );
  });

  it('uses rate 1 for the same currency without a row', () => {
    assert.deepEqual(pickLatestRate([], 'cur-huf', 'cur-huf', '2026-11-07'), {
      fromCurrencyDocumentId: 'cur-huf',
      toCurrencyDocumentId: 'cur-huf',
      rate: 1,
      validFrom: null,
      currencyRateDocumentId: null,
      inverted: false,
    });
  });
});

describe('stepsNeedingRate', () => {
  it('lists distinct target currencies of flagged steps', () => {
    assert.deepEqual(stepsNeedingRate(eggSaleWorkflow, eggSource), {
      from: 'cur-egg',
      to: ['cur-huf'],
    });
  });

  it('returns null when no step is flagged', () => {
    const plain: WorkflowTemplate = {
      ...eggSaleWorkflow,
      step: eggSaleWorkflow.step!.map((step) => ({
        ...step,
        apply_currency_rate: false,
      })),
    };
    assert.equal(stepsNeedingRate(plain, eggSource), null);
  });

  it('requires the source currency when a step is flagged', () => {
    assert.throws(
      () =>
        stepsNeedingRate(eggSaleWorkflow, {
          ...eggSource,
          currency_type: null,
        }),
      (error: unknown) =>
        error instanceof TransactionWorkflowError && error.status === 422,
    );
  });
});

describe('expandWorkflowSteps with apply_currency_rate', () => {
  it('Tojás eladás forintért: 30 EGG × 100 → 3 000 HUF on both HUF steps', () => {
    const rows = expandWorkflowSteps(
      eggSaleWorkflow,
      eggSource,
      new Map(),
      new Map([[huf.documentId, rate(100)]]),
    );
    assert.deepEqual(
      rows.map((row) => [row.amount, row.currency_type.documentId]),
      [
        [30, 'cur-egg'],
        [3000, 'cur-huf'],
        [3000, 'cur-huf'],
      ],
    );
    assert.equal(rows[0].appliedRate, null);
    assert.equal(rows[1].appliedRate?.rate, 100);
    assert.equal(rows[2].appliedRate?.currencyRateDocumentId, 'rate-egg-huf');
    // Member side still resolves from the source row.
    assert.equal(rows[1].credit_account.documentId, memberPrivate.documentId);
  });

  it('multiplies percent and rate, rounding to 2 decimals', () => {
    const workflow: WorkflowTemplate = {
      ...eggSaleWorkflow,
      step: [{ ...eggSaleWorkflow.step![1], percent: 50 }],
    };
    const [row] = expandWorkflowSteps(
      workflow,
      { ...eggSource, amount: 7 },
      new Map(),
      new Map([[huf.documentId, rate(33.3333)]]),
    );
    // 7 × 0.5 × 33.3333 = 116.66655 → 116.67
    assert.equal(row.amount, 116.67);
  });

  it('throws 422 CURRENCY_RATE_MISSING with from/to/date details', () => {
    const error = assertWorkflowError(
      () =>
        expandWorkflowSteps(eggSaleWorkflow, eggSource, new Map(), new Map()),
      ERROR_CURRENCY_RATE_MISSING,
    );
    assert.deepEqual(error.details, {
      from: 'EGG',
      to: 'HUF',
      date: '2026-11-07',
    });
    assert.match(error.message, /EGG → HUF not found on or before 2026-11-07/);
  });

  it('throws 422 CURRENCY_RATE_MISSING when no rates map is passed', () => {
    assertWorkflowError(
      () => expandWorkflowSteps(eggSaleWorkflow, eggSource, new Map()),
      ERROR_CURRENCY_RATE_MISSING,
    );
  });

  it('throws 422 CURRENCY_RATE_INVALID for a zero / negative rate', () => {
    assertWorkflowError(
      () =>
        expandWorkflowSteps(
          eggSaleWorkflow,
          eggSource,
          new Map(),
          new Map([[huf.documentId, rate(0)]]),
        ),
      ERROR_CURRENCY_RATE_INVALID,
    );
  });

  it('uses rate 1 for a flagged step in the source currency', () => {
    const workflow: WorkflowTemplate = {
      ...eggSaleWorkflow,
      step: [{ ...eggSaleWorkflow.step![0], apply_currency_rate: true }],
    };
    const [row] = expandWorkflowSteps(workflow, eggSource, new Map());
    assert.equal(row.amount, 30);
    assert.equal(row.appliedRate?.rate, 1);
    assert.equal(row.appliedRate?.validFrom, null);
  });

  it('leaves flag-free KOR lekötés steps unchanged (percent 1, no rate)', () => {
    const lekotes: WorkflowTemplate = {
      documentId: 'wf-2',
      debit_account_code: 1520,
      credit_account_code: 1000,
      step: [
        {
          __component: STEP_RELATED,
          description: 'Lekötés 1 HUF fedezet',
          percent: 100,
          debit_account: account('1900'),
          credit_account: account('1520'),
          currency_type: huf,
        },
        {
          __component: STEP_RELATED,
          description: 'Lekötés 2 KOR',
          percent: 1,
          debit_account: account('1520'),
          credit_account: account('1900'),
          currency_type: kor,
        },
      ],
    };
    const rows = expandWorkflowSteps(
      lekotes,
      {
        documentId: 'tx-2',
        date: '2026-11-07',
        amount: 800000,
        debit_account: account('1520'),
        credit_account: account('1000'),
        currency_type: huf,
      },
      new Map(),
      // Even if a rate is around, unflagged steps ignore it.
      new Map([
        [
          kor.documentId,
          {
            fromCurrencyDocumentId: huf.documentId,
            toCurrencyDocumentId: kor.documentId,
            rate: 1 / 600,
            validFrom: '2020-01-01T00:00:00.000Z',
            currencyRateDocumentId: 'x',
            inverted: true,
          },
        ],
      ]),
    );
    assert.deepEqual(
      rows.map((row) => [row.amount, row.appliedRate]),
      [
        [800000, null],
        [8000, null],
      ],
    );
  });

  it('2 000 000 HUF / 600 → 3 333.33 KOR with apply_currency_rate', () => {
    const lekotes: WorkflowTemplate = {
      documentId: 'wf-lekotes-rate',
      debit_account_code: 1520,
      credit_account_code: 1000,
      step: [
        {
          __component: STEP_RELATED,
          description: 'Lekötés HUF fedezet',
          percent: 100,
          debit_account: account('1900'),
          credit_account: account('1520'),
          currency_type: huf,
        },
        {
          __component: STEP_RELATED,
          description: 'Lekötés KOR',
          percent: 100,
          debit_account: account('1520'),
          credit_account: account('1900'),
          currency_type: kor,
          apply_currency_rate: true,
        },
      ],
    };
    const expanded = expandWorkflowSteps(
      lekotes,
      {
        documentId: 'tx-lekotes',
        date: '2026-11-07',
        amount: 2_000_000,
        debit_account: account('1520'),
        credit_account: account('1000'),
        currency_type: huf,
      },
      new Map(),
      new Map([
        [
          kor.documentId,
          {
            fromCurrencyDocumentId: huf.documentId,
            toCurrencyDocumentId: kor.documentId,
            rate: 1 / 600,
            validFrom: '2020-01-01T00:00:00.000Z',
            currencyRateDocumentId: 'kor-huf',
            inverted: true,
          },
        ],
      ]),
    );
    assert.equal(expanded[0]?.amount, 2_000_000);
    assert.equal(expanded[0]?.appliedRate, null);
    assert.equal(expanded[1]?.amount, 3333.33);
    assert.equal(expanded[1]?.appliedRate?.inverted, true);
  });
});

describe('expandWorkflowSteps with member ratio', () => {
  const ratio075 = {
    ratio: 0.75,
    membershipDocumentId: 'm-1',
    membershipName: 'Érdeklődő',
    source: 'membership_type' as const,
  };

  it('20 EGG × 100 × 0.75 → 1 500 HUF on both HUF steps, EGG step untouched', () => {
    const rows = expandWorkflowSteps(
      eggSaleWorkflow,
      { ...eggSource, amount: 20 },
      new Map(),
      new Map([[huf.documentId, rate(100)]]),
      ratio075,
    );
    assert.deepEqual(
      rows.map((row) => [row.amount, row.memberRatio?.ratio ?? null]),
      [
        [20, null],
        [1500, 0.75],
        [1500, 0.75],
      ],
    );
  });

  it('appends the ratio to the description of multiplied steps only', () => {
    const rows = expandWorkflowSteps(
      eggSaleWorkflow,
      eggSource,
      new Map(),
      new Map([[huf.documentId, rate(100)]]),
      ratio075,
    );
    assert.deepEqual(
      rows.map((row) => row.description),
      [
        'Tojás eladás (tojás)',
        'Tojás eladás (kp befizetés) · ratio 0.75 (Érdeklődő)',
        'Tojás eladás (bevétel) · ratio 0.75 (Érdeklődő)',
      ],
    );
  });

  it('does not scale a flagged same-currency step', () => {
    const workflow: WorkflowTemplate = {
      ...eggSaleWorkflow,
      step: [{ ...eggSaleWorkflow.step![0], apply_currency_rate: true }],
    };
    const [row] = expandWorkflowSteps(
      workflow,
      eggSource,
      new Map(),
      undefined,
      ratio075,
    );
    assert.equal(row.amount, 30);
    assert.equal(row.memberRatio, null);
    assert.equal(row.description, 'Tojás eladás (tojás)');
  });

  it('ratio 1 / no ratio leaves amount and description unchanged', () => {
    for (const memberRatio of [
      null,
      { ...ratio075, ratio: 1, membershipName: 'Vásárló' },
    ]) {
      const rows = expandWorkflowSteps(
        eggSaleWorkflow,
        eggSource,
        new Map(),
        new Map([[huf.documentId, rate(100)]]),
        memberRatio,
      );
      assert.equal(rows[1].amount, 3000);
      assert.equal(rows[1].description, 'Tojás eladás (kp befizetés)');
    }
  });

  it('rounds after multiplying rate and ratio', () => {
    const [row] = expandWorkflowSteps(
      { ...eggSaleWorkflow, step: [eggSaleWorkflow.step![1]] },
      { ...eggSource, amount: 7 },
      new Map(),
      new Map([[huf.documentId, rate(33.3333)]]),
      { ...ratio075, ratio: 0.3 },
    );
    // 7 × 33.3333 × 0.3 = 69.999930 → 70
    assert.equal(row.amount, 70);
  });

  it('ratio 0 books 0 HUF rows', () => {
    const rows = expandWorkflowSteps(
      eggSaleWorkflow,
      eggSource,
      new Map(),
      new Map([[huf.documentId, rate(100)]]),
      { ...ratio075, ratio: 0 },
    );
    assert.deepEqual(
      rows.map((row) => row.amount),
      [30, 0, 0],
    );
  });
});
