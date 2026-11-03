/**
 * preview.ts unit tests: storno, steps, warnings, 409/422.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STEP_MEMBER_DEBIT,
  STEP_MEMBER_CREDIT,
  STEP_RELATED,
  TransactionWorkflowError,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert.ts';
import {
  buildConvertPreview,
  mergeCurrencyLookupRow,
  previewForTransaction,
  type AccountMetaLookup,
  type CurrencyMetaLookup,
} from './preview.ts';

const huf = { documentId: 'cur-huf', code: 'HUF', name: 'Forint' };
const kor = { documentId: 'cur-kor', code: 'KOR', name: 'Korona' };
const treasury = { documentId: 'org-treasury' };
const typeTransfer = { documentId: 'tt-transfer' };
const typeWire = { documentId: 'tt-wire' };
const typeMining = { documentId: 'tt-mining' };

function account(
  code: string,
  documentId = `acc-${code}`,
  name: string | null = null,
) {
  return { documentId, code, name };
}

function accountLookup(
  ...rows: { documentId: string; code: string; name?: string | null }[]
): AccountMetaLookup {
  return new Map(
    rows.map((row) => [
      row.documentId,
      { code: row.code, name: row.name ?? null },
    ]),
  );
}

function currencyLookup(
  ...rows: {
    documentId: string;
    code?: string | null;
    name?: string | null;
  }[]
): CurrencyMetaLookup {
  return new Map(
    rows.map((row) => [
      row.documentId,
      { code: row.code ?? null, name: row.name ?? null },
    ]),
  );
}

const workflowAdmin: WorkflowTemplate = {
  documentId: 'wf-8',
  name: 'Adminisztráció',
  debit_account_code: 5440,
  credit_account_code: 2000,
  keep_original: true,
  steps_published: true,
  step: [
    {
      __component: STEP_RELATED,
      description: 'Számla',
      percent: 100,
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
      transaction_type: typeTransfer,
      organization: treasury,
    },
    {
      __component: STEP_RELATED,
      description: 'Utalás',
      percent: 100,
      debit_account: account('2000'),
      credit_account: account('1100'),
      currency_type: huf,
      transaction_type: typeWire,
      organization: treasury,
    },
  ],
};

describe('mergeCurrencyLookupRow', () => {
  it('keeps an existing code when a later row only has documentId', () => {
    const merged = mergeCurrencyLookupRow(
      { code: 'EGG', name: 'tojás termelés' },
      { code: null, name: null },
    );
    assert.equal(merged.code, 'EGG');
    assert.equal(merged.name, 'tojás termelés');
  });

  it('fills a missing code from a hydrated row', () => {
    const merged = mergeCurrencyLookupRow(
      { code: null, name: null },
      { code: 'HUF', name: 'Forint' },
    );
    assert.equal(merged.code, 'HUF');
    assert.equal(merged.name, 'Forint');
  });
});

describe('buildConvertPreview', () => {
  it('includes storno then steps when keep_original is true', () => {
    const tx: SourceTransaction = {
      documentId: 'tx-8',
      date: '2026-10-14',
      amount: 80_000,
      description: 'könyvelői számla október',
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
    };
    const preview = buildConvertPreview(
      workflowAdmin,
      tx,
      new Map(),
      accountLookup(account('5440'), account('2000'), account('1100')),
      currencyLookup(huf),
    );
    assert.equal(preview.workflow.keepOriginal, true);
    assert.equal(preview.movements.length, 3);
    assert.equal(preview.movements[0]?.kind, 'storno');
    assert.equal(preview.movements[0]?.amount, -80_000);
    assert.equal(preview.movements[1]?.kind, 'step');
    assert.equal(preview.movements[1]?.index, 0);
    assert.equal(preview.movements[1]?.amount, 80_000);
    assert.equal(preview.movements[2]?.amount, 80_000);
    assert.deepEqual(preview.warnings, []);
  });

  it('shows EGG on original and EGG steps after lookup hydration', () => {
    const egg = { documentId: 'cur-egg', code: 'EGG', name: 'tojás termelés' };
    const huf = { documentId: 'cur-huf', code: 'HUF', name: 'Forint' };
    const wf: WorkflowTemplate = {
      documentId: 'wf-egg',
      debit_account_code: 1001,
      credit_account_code: 4500,
      keep_original: true,
      step: [
        {
          __component: STEP_RELATED,
          description: 'Napi tojás',
          percent: 100,
          debit_account: account('1300'),
          credit_account: account('4500'),
          currency_type: { documentId: egg.documentId },
        },
        {
          __component: STEP_RELATED,
          description: 'Tojás eladás (kp befizetés)',
          percent: 100,
          debit_account: account('1000'),
          credit_account: account('1001'),
          currency_type: { documentId: huf.documentId },
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-egg',
      date: '2026-11-03',
      amount: 111,
      description: 'sfsdf',
      debit_account: account('1001'),
      credit_account: account('4500'),
      currency_type: { documentId: egg.documentId },
    };
    const lookup = new Map<string, { code: string | null; name: string | null }>(
      [
        [egg.documentId, { code: null, name: null }],
        [huf.documentId, { code: 'HUF', name: 'Forint' }],
      ],
    );
    lookup.set(
      egg.documentId,
      mergeCurrencyLookupRow(lookup.get(egg.documentId), egg),
    );

    const preview = buildConvertPreview(
      wf,
      tx,
      new Map(),
      accountLookup(
        account('1001'),
        account('4500'),
        account('1300'),
        account('1000'),
      ),
      lookup,
    );

    assert.equal(preview.original.currency.code, 'EGG');
    assert.equal(preview.movements[0]?.currency.code, 'EGG');
    assert.equal(preview.movements[1]?.currency.code, 'EGG');
    assert.equal(preview.movements[2]?.currency.code, 'HUF');
  });

  it('omits storno when keep_original is false', () => {
    const wf: WorkflowTemplate = {
      ...workflowAdmin,
      keep_original: false,
      step: [
        {
          __component: STEP_RELATED,
          description: 'Only',
          percent: 100,
          debit_account: account('5440'),
          credit_account: account('2000'),
          currency_type: huf,
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-del',
      date: '2026-10-14',
      amount: 10_000,
      description: 'x',
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
    };
    const preview = buildConvertPreview(
      wf,
      tx,
      new Map(),
      accountLookup(account('5440'), account('2000')),
      currencyLookup(huf),
    );
    assert.equal(preview.workflow.keepOriginal, false);
    assert.equal(preview.movements.length, 1);
    assert.equal(preview.movements[0]?.kind, 'step');
  });

  it('does not warn when every chain step uses percent 100 on distinct pairs', () => {
    const wf: WorkflowTemplate = {
      documentId: 'wf-egg',
      name: 'Tojás',
      debit_account_code: 1001,
      credit_account_code: 4500,
      keep_original: true,
      step: [
        {
          __component: STEP_RELATED,
          description: 'Napi tojás',
          percent: 100,
          debit_account: account('1300'),
          credit_account: account('4500'),
          currency_type: huf,
        },
        {
          __component: STEP_RELATED,
          description: 'Tojás eladás',
          percent: 100,
          debit_account: account('1001'),
          credit_account: account('1300'),
          currency_type: huf,
        },
        {
          __component: STEP_RELATED,
          description: 'Kp befizetés',
          percent: 100,
          debit_account: account('1000'),
          credit_account: account('1001'),
          currency_type: huf,
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-egg',
      date: '2026-10-14',
      amount: 324,
      description: 'tojás',
      debit_account: account('1001'),
      credit_account: account('4500'),
      currency_type: huf,
    };
    const preview = buildConvertPreview(
      wf,
      tx,
      new Map(),
      accountLookup(
        account('1000'),
        account('1001'),
        account('1300'),
        account('4500'),
      ),
      currencyLookup(huf),
    );
    assert.deepEqual(preview.warnings, []);
    assert.equal(preview.movements.filter((m) => m.kind === 'step').length, 3);
  });

  it('does not warn when same debit/credit pair percents sum to 100', () => {
    const wf: WorkflowTemplate = {
      documentId: 'wf-split',
      debit_account_code: 5440,
      credit_account_code: 2000,
      keep_original: false,
      step: [
        {
          __component: STEP_RELATED,
          description: 'A',
          percent: 60,
          debit_account: account('5440'),
          credit_account: account('2000'),
          currency_type: huf,
        },
        {
          __component: STEP_RELATED,
          description: 'B',
          percent: 40,
          debit_account: account('5440'),
          credit_account: account('2000'),
          currency_type: huf,
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-split',
      date: '2026-10-14',
      amount: 10_000,
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
    };
    const preview = buildConvertPreview(
      wf,
      tx,
      new Map(),
      accountLookup(account('5440'), account('2000')),
      currencyLookup(huf),
    );
    assert.deepEqual(preview.warnings, []);
  });

  it('warns when same debit/credit pair percents do not sum to 100', () => {
    const wf: WorkflowTemplate = {
      documentId: 'wf-bad-split',
      debit_account_code: 5440,
      credit_account_code: 2000,
      keep_original: false,
      step: [
        {
          __component: STEP_RELATED,
          description: 'A',
          percent: 60,
          debit_account: account('5440'),
          credit_account: account('2000'),
          currency_type: huf,
        },
        {
          __component: STEP_RELATED,
          description: 'B',
          percent: 30,
          debit_account: account('5440'),
          credit_account: account('2000'),
          currency_type: huf,
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-bad',
      date: '2026-10-14',
      amount: 10_000,
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
    };
    const preview = buildConvertPreview(
      wf,
      tx,
      new Map(),
      accountLookup(account('5440'), account('2000')),
      currencyLookup(huf),
    );
    assert.ok(
      preview.warnings.some((line) => line.includes('do not sum to 100%')),
    );
  });

  it('warns when receipts exist but no copy_receipt with keep_original false', () => {
    const wf: WorkflowTemplate = {
      ...workflowAdmin,
      keep_original: false,
      step: [
        {
          __component: STEP_RELATED,
          description: 'Leg',
          percent: 100,
          debit_account: account('5440'),
          credit_account: account('2000'),
          currency_type: huf,
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-rcpt',
      date: '2026-10-14',
      amount: 1,
      description: 'x',
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
      receipts: [{ documentId: 'r1' }],
    };
    const preview = buildConvertPreview(
      wf,
      tx,
      new Map(),
      accountLookup(account('5440'), account('2000')),
      currencyLookup(huf),
    );
    assert.ok(preview.warnings.some((line) => line.includes('copy_receipt')));
  });

  it('expands templates and resolves member accounts from sibling map', () => {
    const tag1101 = account('1101', 'acc-erika-1101');
    const tag1001 = account('1001', 'acc-erika-1001');
    const wf: WorkflowTemplate = {
      documentId: 'wf-1',
      debit_account_code: 1520,
      credit_account_code: 1101,
      keep_original: true,
      step: [
        {
          __component: STEP_MEMBER_DEBIT,
          description: '{1}',
          percent: 100,
          member_account_code: '1101',
          credit_account: account('3000'),
          currency_type: huf,
          organization: treasury,
        },
        {
          __component: STEP_MEMBER_CREDIT,
          description: 'Telek',
          percent: 100,
          member_account_code: '1001',
          debit_account: account('1520'),
          currency_type: kor,
          organization: treasury,
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-1',
      date: '2026-10-14',
      amount: 100,
      description: 'tagi befizetés',
      debit_account: account('1520'),
      credit_account: tag1101,
      currency_type: huf,
    };
    const sibling = new Map([
      ['1101', tag1101],
      ['1001', tag1001],
    ]);
    const preview = buildConvertPreview(
      wf,
      tx,
      sibling,
      accountLookup(tag1101, tag1001, account('1520'), account('3000')),
      currencyLookup(huf, kor),
    );
    assert.equal(preview.movements[1]?.debit.code, '1101');
    assert.equal(preview.movements[2]?.credit.code, '1001');
    assert.equal(preview.movements[1]?.description, 'tagi befizetés');
  });

  it('throws 422 when workflow has no steps', () => {
    const wf: WorkflowTemplate = {
      documentId: 'wf-empty',
      debit_account_code: 5440,
      credit_account_code: 2000,
      step: [],
    };
    const tx: SourceTransaction = {
      documentId: 'tx',
      date: '2026-01-01',
      amount: 1,
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
    };
    assert.throws(
      () =>
        buildConvertPreview(
          wf,
          tx,
          new Map(),
          accountLookup(account('5440'), account('2000')),
          currencyLookup(huf),
        ),
      (error: unknown) =>
        error instanceof TransactionWorkflowError && error.status === 422,
    );
  });
});

describe('previewForTransaction', () => {
  it('throws 409 when multiple templates match', () => {
    const tx: SourceTransaction = {
      documentId: 'tx-dup',
      date: '2026-01-01',
      amount: 1,
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
    };
    assert.throws(
      () =>
        previewForTransaction(
          [workflowAdmin, workflowAdmin],
          tx,
          new Map(),
          accountLookup(account('5440'), account('2000'), account('1100')),
          currencyLookup(huf),
        ),
      (error: unknown) =>
        error instanceof TransactionWorkflowError && error.status === 409,
    );
  });
});
