import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TransactionWorkflowError,
  expandDescription,
  expandWorkflowSteps,
  pickMatchingWorkflow,
  stepAmount,
  workflowMatchesTransaction,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert.ts';

const treasury = { documentId: 'org-treasury' };
const project = { documentId: 'org-project' };
const huf = { documentId: 'cur-huf' };
const kor = { documentId: 'cur-kor' };
const typeTransfer = { documentId: 'tt-transfer' };
const typeWire = { documentId: 'tt-wire' };
const typeMining = { documentId: 'tt-mining' };

function account(code: string, documentId = `acc-${code}`) {
  return { documentId, code };
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
      description: 'Számla',
      percent: 100,
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
      transaction_type: typeTransfer,
      organization: treasury,
    },
    {
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

describe('workflowMatchesTransaction', () => {
  it('matches debit/credit codes and ignores converted rows', () => {
    const tx: SourceTransaction = {
      documentId: 'tx-1',
      date: '2026-10-14',
      amount: 80_000,
      description: 'könyvelő',
      converted_to_workflow: false,
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
    };
    assert.equal(workflowMatchesTransaction(workflowAdmin, tx), true);
    assert.equal(
      workflowMatchesTransaction(workflowAdmin, {
        ...tx,
        converted_to_workflow: true,
      }),
      false,
    );
  });

  it('applies optional currency and transaction type filters', () => {
    const wf: WorkflowTemplate = {
      ...workflowAdmin,
      currency_type: huf,
      transaction_type: typeMining,
    };
    const tx: SourceTransaction = {
      documentId: 'tx-9',
      date: '2026-10-14',
      amount: 50_000,
      description: 'bányászás',
      debit_account: account('1001', 'acc-tag-1001'),
      credit_account: account('1100'),
      currency_type: huf,
      transaction_type: typeMining,
    };
    const miningWf: WorkflowTemplate = {
      documentId: 'wf-9',
      debit_account_code: 1001,
      credit_account_code: 1100,
      transaction_type: typeMining,
      step: [
        {
          description: 'Bányászás',
          percent: 100,
          debit_account: account('1001'),
          credit_account: account('1100'),
          currency_type: huf,
          transaction_type: typeMining,
          organization: treasury,
        },
      ],
    };
    assert.equal(workflowMatchesTransaction(miningWf, tx), true);
    assert.equal(
      workflowMatchesTransaction(
        { ...miningWf, transaction_type: { documentId: 'other' } },
        tx,
      ),
      false,
    );
    assert.equal(workflowMatchesTransaction(wf, tx), false);
  });
});

describe('pickMatchingWorkflow', () => {
  it('returns null when nothing matches', () => {
    const tx: SourceTransaction = {
      documentId: 'tx-x',
      date: '2026-01-01',
      amount: 1,
      debit_account: account('9999'),
      credit_account: account('2000'),
    };
    assert.equal(pickMatchingWorkflow([workflowAdmin], tx), null);
  });

  it('throws 409 when multiple templates match', () => {
    const tx: SourceTransaction = {
      documentId: 'tx-dup',
      date: '2026-01-01',
      amount: 1,
      debit_account: account('5440'),
      credit_account: account('2000'),
    };
    assert.throws(
      () => pickMatchingWorkflow([workflowAdmin, workflowAdmin], tx),
      (error: unknown) =>
        error instanceof TransactionWorkflowError && error.status === 409,
    );
  });
});

describe('expandWorkflowSteps', () => {
  it('expands ügylet 8 with percent amounts and descriptions', () => {
    const tx: SourceTransaction = {
      documentId: 'tx-8',
      date: '2026-10-14',
      amount: 80_000,
      description: 'könyvelői számla október',
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
    };
    const rows = expandWorkflowSteps(workflowAdmin, tx, new Map());
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.amount, 80_000);
    assert.equal(rows[0]?.description, 'Számla');
    assert.equal(rows[1]?.entered_key, 'tx-8:step:1');
  });

  it('resolves tag 1101/1001 from the source transaction and sibling map', () => {
    const tag1101 = account('1101', 'acc-erika-1101');
    const tag1001 = account('1001', 'acc-erika-1001');
    const wf: WorkflowTemplate = {
      documentId: 'wf-1',
      debit_account_code: 1520,
      credit_account_code: 1101,
      step: [
        {
          description: '{1}',
          percent: 100,
          debit_account: account('1101'),
          credit_account: account('3000'),
          currency_type: huf,
          organization: treasury,
        },
        {
          description: 'Stróman',
          percent: 96.153846,
          debit_account: account('1001'),
          credit_account: account('1100'),
          currency_type: kor,
          organization: treasury,
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-1',
      date: '2026-10-14',
      amount: 2_080_000,
      description: 'tagi befizetés',
      debit_account: account('1520'),
      credit_account: tag1101,
      currency_type: huf,
    };
    const sibling = new Map([
      ['1101', tag1101],
      ['1001', tag1001],
    ]);
    const rows = expandWorkflowSteps(wf, tx, sibling);
    assert.equal(rows[0]?.debit_account.documentId, 'acc-erika-1101');
    assert.equal(rows[1]?.debit_account.documentId, 'acc-erika-1001');
    assert.equal(rows[1]?.amount, stepAmount(2_080_000, 96.153846));
  });

  it('copies {1} placeholder into step description', () => {
    assert.equal(expandDescription('{1}', 'forrás szöveg'), 'forrás szöveg');
    assert.equal(expandDescription('Fix cím', 'forrás'), 'Fix cím');
  });
});

describe('stepAmount', () => {
  it('computes fractional percents for korona legs', () => {
    assert.equal(stepAmount(2_080_000, 0.961538), (2_080_000 * 0.961538) / 100);
  });
});
