import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  STEP_RELATED,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert.ts';
import {
  CUSTOMISED_CONVERSION_NOTE,
  resolveCustomisedStepRows,
  type ConvertOverridesPayload,
} from './convert-overrides.ts';

const huf = { documentId: 'cur-huf', code: 'HUF' };

function account(code: string, documentId = `acc-${code}`) {
  return { documentId, code };
}

const workflow: WorkflowTemplate = {
  documentId: 'wf-1',
  debit_account_code: 5440,
  credit_account_code: 2000,
  keep_original: true,
  step: [
    {
      __component: STEP_RELATED,
      description: 'Step one',
      percent: 50,
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
    },
    {
      __component: STEP_RELATED,
      description: 'Step two',
      percent: 50,
      debit_account: account('2000'),
      credit_account: account('5440'),
      currency_type: huf,
    },
  ],
};

const source: SourceTransaction = {
  documentId: 'tx-1',
  date: '2026-11-03',
  amount: 100,
  description: 'source',
  debit_account: account('5440'),
  credit_account: account('2000'),
  currency_type: huf,
  organization: { documentId: 'org-1' },
};

const accounts = new Map([
  ['acc-5440', { documentId: 'acc-5440', code: '5440' }],
  ['acc-2000', { documentId: 'acc-2000', code: '2000' }],
]);

const currencies = new Map([
  ['cur-huf', { documentId: 'cur-huf', code: 'HUF' }],
]);

describe('resolveCustomisedStepRows', () => {
  it('marks descriptions and preserves entered_key for baseline indices', () => {
    const overrides: ConvertOverridesPayload = {
      legs: [
        {
          key: 'step:0',
          sourceStepIndex: 0,
          description: 'Custom one',
          amount: 50,
          percent: 50,
          debitAccountDocumentId: 'acc-5440',
          creditAccountDocumentId: 'acc-2000',
          currencyTypeDocumentId: 'cur-huf',
          organizationDocumentId: 'org-1',
          copyReceipt: false,
        },
        {
          key: 'step:1',
          sourceStepIndex: 1,
          description: 'Custom two',
          amount: 50,
          percent: 50,
          debitAccountDocumentId: 'acc-2000',
          creditAccountDocumentId: 'acc-5440',
          currencyTypeDocumentId: 'cur-huf',
          organizationDocumentId: 'org-1',
          copyReceipt: true,
        },
      ],
    };

    const rows = resolveCustomisedStepRows(
      workflow,
      source,
      new Map(),
      undefined,
      null,
      overrides,
      accounts,
      currencies,
    );

    assert.equal(rows.length, 2);
    assert.match(rows[0]!.description, new RegExp(CUSTOMISED_CONVERSION_NOTE));
    assert.equal(rows[0]!.entered_key, 'tx-1:step:0');
    assert.equal(rows[1]!.copy_receipt, true);
  });

  it('rejects identical debit/credit accounts', () => {
    const overrides: ConvertOverridesPayload = {
      legs: [
        {
          key: 'bad',
          sourceStepIndex: 0,
          description: 'Bad',
          amount: 100,
          percent: 100,
          debitAccountDocumentId: 'acc-5440',
          creditAccountDocumentId: 'acc-5440',
          currencyTypeDocumentId: 'cur-huf',
          copyReceipt: false,
        },
      ],
    };

    assert.throws(
      () =>
        resolveCustomisedStepRows(
          workflow,
          source,
          new Map(),
          undefined,
          null,
          overrides,
          accounts,
          currencies,
        ),
      /must differ/,
    );
  });

  it('assigns a new entered_key for added legs', () => {
    const overrides: ConvertOverridesPayload = {
      legs: [
        {
          key: 'custom:x',
          sourceStepIndex: null,
          description: 'Added',
          amount: 100,
          percent: 100,
          debitAccountDocumentId: 'acc-5440',
          creditAccountDocumentId: 'acc-2000',
          currencyTypeDocumentId: 'cur-huf',
          copyReceipt: false,
        },
      ],
    };

    const rows = resolveCustomisedStepRows(
      workflow,
      source,
      new Map(),
      undefined,
      null,
      overrides,
      accounts,
      currencies,
    );
    assert.equal(rows[0]!.entered_key, 'tx-1:step:custom:custom:x');
    assert.equal(rows[0]!.amount, 100);
  });
});
