/**
 * convert.ts unit tesztek: match, expand, tagi 1101/1001, ügylet 8/9 minták, 409 több sablon.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STEP_MEMBER_CREDIT,
  STEP_MEMBER_DEBIT,
  STEP_RELATED,
  TransactionWorkflowError,
  accountCodeMatchesPattern,
  buildStornoRowShape,
  expandDescription,
  expandTemplate,
  expandWorkflowSteps,
  isExactAccountCodePattern,
  normalizeWorkflowStep,
  pickMatchingWorkflow,
  resolveStepOrganization,
  stepAmount,
  stripDescriptionComments,
  workflowMatchesTransaction,
  workflowRequiresSourceOrganization,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert.ts';

const treasury = { documentId: 'org-treasury' };
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

describe('workflowMatchesTransaction', () => {
  it('matches debit/credit codes and ignores converted rows', () => {
    const tx: SourceTransaction = {
      documentId: 'tx-1',
      date: '2026-10-14',
      amount: 80_000,
      description: 'könyvelő',
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
    };
    assert.equal(workflowMatchesTransaction(workflowAdmin, tx), true);
    assert.equal(
      workflowMatchesTransaction(workflowAdmin, {
        ...tx,
        converted_to_workflow: 'original',
      }),
      false,
    );
    assert.equal(
      workflowMatchesTransaction(workflowAdmin, {
        ...tx,
        converted_to_workflow: 'expanded',
      }),
      false,
    );
    assert.equal(
      workflowMatchesTransaction(workflowAdmin, {
        ...tx,
        converted_to_workflow: 'storno',
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
          __component: STEP_MEMBER_DEBIT,
          description: 'Bányászás',
          percent: 100,
          member_account_code: '1001',
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

describe('workflowMatchesTransaction (területalapú seed)', () => {
  it('matches debit 1200 and credit 4200 from kor workflow 05', () => {
    const wf: WorkflowTemplate = {
      documentId: 'wf-5',
      name: 'Területalapú agrár támogatás',
      debit_account_code: 1200,
      credit_account_code: 4200,
      step: [],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-agrar',
      date: '2026-06-01',
      amount: 250_000,
      description: 'NAK támogatás',
      debit_account: account('1200'),
      credit_account: account('4200'),
      currency_type: huf,
    };
    assert.equal(workflowMatchesTransaction(wf, tx), true);
    assert.equal(
      workflowMatchesTransaction(wf, {
        ...tx,
        credit_account: account('4201'),
      }),
      false,
    );
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

  it('throws 409 when exact and glob both match', () => {
    const globWf: WorkflowTemplate = {
      ...workflowAdmin,
      documentId: 'wf-glob',
      debit_account_code: '5*',
    };
    const tx: SourceTransaction = {
      documentId: 'tx-dup-glob',
      date: '2026-01-01',
      amount: 1,
      debit_account: account('5440'),
      credit_account: account('2000'),
    };
    assert.throws(
      () => pickMatchingWorkflow([workflowAdmin, globWf], tx),
      (error: unknown) =>
        error instanceof TransactionWorkflowError && error.status === 409,
    );
  });
});

describe('workflowMatchesTransaction (pattern headers)', () => {
  it('matches regex debit with exact credit', () => {
    const wf: WorkflowTemplate = {
      documentId: 'wf-re',
      debit_account_code: '15[23]0',
      credit_account_code: '1101',
      step: [],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-re',
      date: '2026-01-01',
      amount: 1,
      debit_account: account('1520'),
      credit_account: account('1101'),
    };
    assert.equal(workflowMatchesTransaction(wf, tx), true);
    assert.equal(
      workflowMatchesTransaction(wf, {
        ...tx,
        debit_account: account('1510'),
      }),
      false,
    );
  });

  it('matches kor részjegy project pattern; type disambiguates 15xx/1101', () => {
    const pattern = '(5(00|10|4[0-9]|50|80)0|15[0-9]0)';
    const resz: WorkflowTemplate = {
      documentId: 'wf-resz',
      debit_account_code: pattern,
      credit_account_code: '1101',
      transaction_type: { documentId: 'type-resz' },
      step: [],
    };
    const lekot: WorkflowTemplate = {
      documentId: 'wf-lekot',
      debit_account_code: '15[12]0',
      credit_account_code: '1101',
      transaction_type: { documentId: 'type-lekot' },
      step: [],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-1510',
      date: '2026-01-01',
      amount: 2_500_000,
      debit_account: account('1510'),
      credit_account: account('1101'),
      transaction_type: { documentId: 'type-resz' },
    };
    assert.equal(accountCodeMatchesPattern('1510', pattern), true);
    assert.equal(workflowMatchesTransaction(resz, tx), true);
    assert.equal(workflowMatchesTransaction(lekot, tx), false);
    assert.equal(
      pickMatchingWorkflow([resz, lekot], tx)?.documentId,
      'wf-resz',
    );
    assert.equal(
      workflowMatchesTransaction(resz, {
        ...tx,
        transaction_type: null,
      }),
      false,
    );
  });
});

describe('accountCodeMatchesPattern', () => {
  it('matches exact codes and coerces numbers', () => {
    assert.equal(accountCodeMatchesPattern('5400', '5400'), true);
    assert.equal(accountCodeMatchesPattern(5400, 5400), true);
    assert.equal(accountCodeMatchesPattern('5401', '5400'), false);
    assert.equal(accountCodeMatchesPattern('5400', ''), false);
    assert.equal(accountCodeMatchesPattern('', '5400'), false);
    assert.equal(isExactAccountCodePattern('5400'), true);
    assert.equal(isExactAccountCodePattern('5*'), false);
    assert.equal(isExactAccountCodePattern('15[23]0'), false);
  });

  it('glob: * and ? stay digit wildcards (not regex quantifiers)', () => {
    assert.equal(accountCodeMatchesPattern('5000', '5*'), true);
    assert.equal(accountCodeMatchesPattern('5999', '5*'), true);
    assert.equal(accountCodeMatchesPattern('5400', '5*'), true);
    assert.equal(accountCodeMatchesPattern('4000', '5*'), false);
    assert.equal(accountCodeMatchesPattern('6100', '5*'), false);
    assert.equal(accountCodeMatchesPattern('5400', '54*'), true);
    assert.equal(accountCodeMatchesPattern('5499', '54*'), true);
    assert.equal(accountCodeMatchesPattern('5300', '54*'), false);
    assert.equal(accountCodeMatchesPattern('1520', '15?0'), true);
    assert.equal(accountCodeMatchesPattern('1530', '15?0'), true);
    assert.equal(accountCodeMatchesPattern('1500', '15?0'), true);
    assert.equal(accountCodeMatchesPattern('1540', '15?0'), true);
    assert.equal(accountCodeMatchesPattern('152', '15?0'), false);
    assert.equal(accountCodeMatchesPattern('10', '15?0'), false);
    assert.equal(accountCodeMatchesPattern('150', '15?0'), false);
    assert.equal(accountCodeMatchesPattern('5000', '5?00'), true);
    assert.equal(accountCodeMatchesPattern('5100', '5?00'), true);
    assert.equal(accountCodeMatchesPattern('5900', '5?00'), true);
    assert.equal(accountCodeMatchesPattern('5201', '5?00'), false);
    assert.equal(accountCodeMatchesPattern('500', '5?00'), false);
  });

  it('regex heuristic: brackets / paren / pipe', () => {
    assert.equal(accountCodeMatchesPattern('1520', '15[23]0'), true);
    assert.equal(accountCodeMatchesPattern('1530', '15[23]0'), true);
    assert.equal(accountCodeMatchesPattern('1510', '15[23]0'), false);
    assert.equal(accountCodeMatchesPattern('1540', '15[23]0'), false);
    assert.equal(accountCodeMatchesPattern('1521', '15[23]0'), false);
    assert.equal(accountCodeMatchesPattern('1520', '15(2|3)0'), true);
    assert.equal(accountCodeMatchesPattern('1530', '15(2|3)0'), true);
    assert.equal(accountCodeMatchesPattern('1510', '15(2|3)0'), false);
    assert.equal(
      accountCodeMatchesPattern('5400', '5(00|10|4[0-9]|50|80)0'),
      true,
    );
    assert.equal(
      accountCodeMatchesPattern('5100', '5(00|10|4[0-9]|50|80)0'),
      true,
    );
    assert.equal(
      accountCodeMatchesPattern('5490', '5(00|10|4[0-9]|50|80)0'),
      true,
    );
    assert.equal(
      accountCodeMatchesPattern('5800', '5(00|10|4[0-9]|50|80)0'),
      true,
    );
    assert.equal(
      accountCodeMatchesPattern('5200', '5(00|10|4[0-9]|50|80)0'),
      false,
    );
  });

  it('invalid regex returns false instead of throwing', () => {
    assert.equal(accountCodeMatchesPattern('1520', '15('), false);
  });
});

describe('normalizeWorkflowStep', () => {
  it('maps related, member-debit and member-credit components', () => {
    const related = normalizeWorkflowStep({
      __component: STEP_RELATED,
      debit_account: account('1520'),
      credit_account: account('1000'),
      currency_type: huf,
    });
    assert.equal(related.debitWanted, '1520');
    assert.equal(related.creditWanted, '1000');

    const memberDebit = normalizeWorkflowStep({
      __component: STEP_MEMBER_DEBIT,
      member_account_code: '1101',
      credit_account: account('3000'),
      currency_type: huf,
    });
    assert.equal(memberDebit.debitWanted, '1101');
    assert.equal(memberDebit.creditWanted, '3000');
    assert.equal(memberDebit.debitRelation, null);

    const memberCredit = normalizeWorkflowStep({
      __component: STEP_MEMBER_CREDIT,
      member_account_code: '1001',
      debit_account: account('1520'),
      currency_type: huf,
    });
    assert.equal(memberCredit.creditWanted, '1001');
    assert.equal(memberCredit.debitWanted, '1520');
    assert.equal(memberCredit.creditRelation, null);
  });

  it('accepts from_original flags without account/currency relations', () => {
    const related = normalizeWorkflowStep({
      __component: STEP_RELATED,
      debit_account_from_original: 'debit',
      credit_account_from_original: 'credit',
      currency_from_original: true,
    });
    assert.equal(related.debit_from_original, 'debit');
    assert.equal(related.credit_from_original, 'credit');
    assert.equal(related.currency_from_original, true);
    assert.equal(related.debitWanted, '');
    assert.equal(related.creditWanted, '');
  });

  it('accepts crossed from_original sides and legacy boolean true', () => {
    const crossed = normalizeWorkflowStep({
      __component: STEP_RELATED,
      debit_account_from_original: 'credit',
      credit_account_from_original: 'debit',
      currency_type: huf,
    });
    assert.equal(crossed.debit_from_original, 'credit');
    assert.equal(crossed.credit_from_original, 'debit');

    const legacy = normalizeWorkflowStep({
      __component: STEP_RELATED,
      debit_account_from_original: true,
      credit_account_from_original: true,
      currency_type: huf,
    });
    assert.equal(legacy.debit_from_original, 'debit');
    assert.equal(legacy.credit_from_original, 'credit');
  });

  it('rejects missing or unknown __component', () => {
    assert.throws(
      () => normalizeWorkflowStep({ debit_account: account('1100') }),
      (error: unknown) =>
        error instanceof TransactionWorkflowError && error.status === 422,
    );
    assert.throws(
      () =>
        normalizeWorkflowStep({
          __component: 'workflow.unknown',
          debit_account: account('1100'),
          currency_type: huf,
        }),
      (error: unknown) =>
        error instanceof TransactionWorkflowError && error.status === 422,
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

  it('resolves tag 1101/1001 from member step components', () => {
    const tag1101 = account('1101', 'acc-erika-1101');
    const tag1001 = account('1001', 'acc-erika-1001');
    const wf: WorkflowTemplate = {
      documentId: 'wf-1',
      debit_account_code: 1520,
      credit_account_code: 1101,
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
          __component: STEP_MEMBER_DEBIT,
          description: 'Stróman',
          percent: 96.153846,
          member_account_code: '1001',
          credit_account: account('1100'),
          currency_type: kor,
          organization: treasury,
        },
        {
          __component: STEP_MEMBER_CREDIT,
          description: 'Telek',
          percent: 96.153846,
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
    assert.equal(rows[2]?.credit_account.documentId, 'acc-erika-1001');
    assert.equal(rows[1]?.amount, stepAmount(2_080_000, 96.153846));
  });

  it('copies {1} placeholder into step description', () => {
    assert.equal(expandDescription('{1}', 'forrás szöveg'), 'forrás szöveg');
    assert.equal(expandDescription('Fix cím', 'forrás'), 'Fix cím');
  });

  it('expands {original.description} and leaves empty source empty', () => {
    const tx: SourceTransaction = {
      documentId: 'tx-tpl',
      date: '2026-10-14',
      amount: 10_000,
      description: 'felújítás',
      debit_account: account('1500'),
      credit_account: account('2000'),
    };
    assert.equal(
      expandTemplate('{original.description} Aktiválás', tx),
      'felújítás Aktiválás',
    );
    assert.equal(
      expandTemplate('{original.description} Aktiválás', {
        ...tx,
        description: null,
      }),
      ' Aktiválás',
    );
    assert.equal(expandTemplate('{1} Utalás', tx), 'felújítás Utalás');
    assert.equal(expandTemplate('{original.unknown} x', tx), ' x');
  });

  it('strips excel HTML comment lines from expanded descriptions', () => {
    const excel = [
      '<!-- excel -->',
      '<!-- Excel: #114 -->',
      '<!-- Művelet: Kölcsön -->',
      '<!-- /excel -->',
    ].join('\n');
    const tx: SourceTransaction = {
      documentId: 'tx-excel',
      date: '2026-01-01',
      amount: 1,
      description: `BALÁZS ERIKA (részjegy)\n\n${excel}`,
      debit_account: account('1510'),
      credit_account: account('1101'),
    };
    assert.equal(
      stripDescriptionComments(tx.description),
      'BALÁZS ERIKA (részjegy)',
    );
    assert.equal(
      expandTemplate('{original.description} | Részjegy előírása', tx),
      'BALÁZS ERIKA (részjegy) | Részjegy előírása',
    );
    assert.equal(
      buildStornoRowShape({
        ...tx,
        currency_type: { documentId: 'cur-huf' },
      }).description,
      'BALÁZS ERIKA (részjegy)',
    );
  });

  it('expands original debit/credit/currency placeholders', () => {
    const tx: SourceTransaction = {
      documentId: 'tx-codes',
      date: '2026-10-14',
      amount: 10_000,
      description: 'x',
      debit_account: account('5400'),
      credit_account: account('1101'),
      currency_type: { documentId: 'cur-huf', code: 'HUF' },
    };
    assert.equal(
      expandTemplate(
        '{original.debit_account_code}/{original.credit_account_code}/{original.currency}',
        tx,
      ),
      '5400/1101/HUF',
    );
  });

  it('copies debit/credit/currency from original when flags are set', () => {
    const sourceDebit = account('5400', 'acc-src-debit');
    const sourceCredit = account('1101', 'acc-src-credit');
    const wf: WorkflowTemplate = {
      documentId: 'wf-from-orig',
      debit_account_code: '5*',
      credit_account_code: '1101',
      step: [
        {
          __component: STEP_RELATED,
          description: '{original.debit_account_code} {original.currency}',
          percent: 100,
          debit_account_from_original: 'debit',
          credit_account_from_original: 'credit',
          currency_from_original: true,
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-from-orig',
      date: '2026-10-14',
      amount: 12_000,
      description: 'költség',
      debit_account: sourceDebit,
      credit_account: sourceCredit,
      currency_type: { documentId: 'cur-huf', code: 'HUF' },
    };
    const rows = expandWorkflowSteps(wf, tx, new Map());
    assert.equal(rows[0]?.debit_account.documentId, 'acc-src-debit');
    assert.equal(rows[0]?.credit_account.documentId, 'acc-src-credit');
    assert.equal(rows[0]?.currency_type.documentId, 'cur-huf');
    assert.equal(rows[0]?.description, '5400 HUF');
  });

  it('copies crossed original sides (credit ← original debit)', () => {
    const sourceDebit = account('5400', 'acc-src-debit');
    const sourceCredit = account('1101', 'acc-src-credit');
    const wf: WorkflowTemplate = {
      documentId: 'wf-crossed',
      debit_account_code: '5*',
      credit_account_code: '1101',
      step: [
        {
          __component: STEP_RELATED,
          description: 'fedezet',
          percent: 100,
          debit_account: account('1900'),
          credit_account_from_original: 'debit',
          currency_type: huf,
        },
      ],
    };
    const rows = expandWorkflowSteps(
      wf,
      {
        documentId: 'tx-crossed',
        date: '2026-10-14',
        amount: 1000,
        debit_account: sourceDebit,
        credit_account: sourceCredit,
        currency_type: huf,
      },
      new Map(),
    );
    assert.equal(rows[0]?.debit_account.documentId, 'acc-1900');
    assert.equal(rows[0]?.credit_account.documentId, 'acc-src-debit');
  });

  it('rejects from_original when source account or currency is missing', () => {
    const wf: WorkflowTemplate = {
      documentId: 'wf-missing',
      debit_account_code: '5400',
      credit_account_code: '1101',
      step: [
        {
          __component: STEP_RELATED,
          description: 'x',
          percent: 100,
          debit_account_from_original: 'debit',
          credit_account: account('3000'),
          currency_from_original: true,
        },
      ],
    };
    assert.throws(
      () =>
        expandWorkflowSteps(
          wf,
          {
            documentId: 'tx-missing',
            date: '2026-10-14',
            amount: 1,
            credit_account: account('1101'),
            currency_type: huf,
          },
          new Map(),
        ),
      (error: unknown) =>
        error instanceof TransactionWorkflowError && error.status === 422,
    );
  });

  it('currency_from_original with apply_currency_rate is same-currency no-op', () => {
    const wf: WorkflowTemplate = {
      documentId: 'wf-rate-same',
      debit_account_code: '5400',
      credit_account_code: '1101',
      step: [
        {
          __component: STEP_RELATED,
          description: 'same',
          percent: 100,
          debit_account: account('5400'),
          credit_account: account('1101'),
          currency_from_original: true,
          apply_currency_rate: true,
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-rate-same',
      date: '2026-10-14',
      amount: 1000,
      debit_account: account('5400'),
      credit_account: account('1101'),
      currency_type: huf,
    };
    const rows = expandWorkflowSteps(wf, tx, new Map());
    assert.equal(rows[0]?.amount, 1000);
    assert.equal(rows[0]?.currency_type.documentId, 'cur-huf');
    assert.ok(rows[0]?.appliedRate);
    assert.equal(rows[0]?.appliedRate?.rate, 1);
  });

  it('copies organization only when organization_from_original is set', () => {
    const project = { documentId: 'org-project' };
    const tx: SourceTransaction = {
      documentId: 'tx-org',
      date: '2026-10-14',
      amount: 10_000,
      description: 'felújítás',
      debit_account: account('1500'),
      credit_account: account('2000'),
      organization: project,
    };
    assert.deepEqual(
      resolveStepOrganization(
        { organization_from_original: true, organization: null },
        tx,
      ),
      project,
    );
    assert.equal(
      resolveStepOrganization(
        { organization_from_original: true, organization: null },
        { ...tx, organization: null },
      ),
      null,
    );
    assert.equal(
      resolveStepOrganization(
        { organization_from_original: false, organization: null },
        tx,
      ),
      null,
    );
    assert.deepEqual(
      resolveStepOrganization(
        { organization_from_original: false, organization: treasury },
        tx,
      ),
      treasury,
    );
  });

  it('requires source organization when any step uses organization_from_original', () => {
    const wf: WorkflowTemplate = {
      documentId: 'wf-org-req',
      name: 'Org from original',
      debit_account_code: 1500,
      credit_account_code: 2000,
      step: [
        {
          __component: STEP_RELATED,
          description: '{1}',
          percent: 100,
          debit_account: account('1500'),
          credit_account: account('2000'),
          currency_type: huf,
          organization_from_original: true,
        },
      ],
    };
    assert.equal(workflowRequiresSourceOrganization(wf), true);
    assert.equal(workflowRequiresSourceOrganization(workflowAdmin), false);

    const tx: SourceTransaction = {
      documentId: 'tx-missing-org',
      date: '2026-10-14',
      amount: 10_000,
      description: 'felújítás',
      debit_account: account('1500'),
      credit_account: account('2000'),
      organization: null,
    };
    assert.throws(
      () => expandWorkflowSteps(wf, tx, new Map()),
      (error: unknown) =>
        error instanceof TransactionWorkflowError &&
        error.status === 422 &&
        error.message.includes('organization is required'),
    );
  });

  it('expands felújítás-style steps with original templates', () => {
    const project = { documentId: 'org-project' };
    const wf: WorkflowTemplate = {
      documentId: 'wf-4',
      name: 'Felújítás',
      debit_account_code: 1500,
      credit_account_code: 2000,
      step: [
        {
          __component: STEP_RELATED,
          description: '{original.description} Aktiválás',
          percent: 100,
          debit_account: account('1500'),
          credit_account: account('2000'),
          currency_type: huf,
          transaction_type: typeTransfer,
          organization_from_original: true,
        },
        {
          __component: STEP_RELATED,
          description: '{original.description} Utalás',
          percent: 100,
          debit_account: account('2000'),
          credit_account: account('1100'),
          currency_type: huf,
          transaction_type: typeWire,
          organization_from_original: true,
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-4',
      date: '2026-10-14',
      amount: 500_000,
      description: 'ól felújítás',
      debit_account: account('1500'),
      credit_account: account('2000'),
      organization: project,
    };
    const rows = expandWorkflowSteps(wf, tx, new Map());
    assert.equal(rows[0]?.description, 'ól felújítás Aktiválás');
    assert.equal(rows[1]?.description, 'ól felújítás Utalás');
    assert.deepEqual(rows[0]?.organization, project);
    assert.deepEqual(rows[1]?.organization, project);
  });
});

describe('stepAmount', () => {
  it('computes fractional percents for korona legs', () => {
    assert.equal(stepAmount(2_080_000, 0.961538), (2_080_000 * 0.961538) / 100);
  });
});

describe('egg production pool transfer steps', () => {
  it('resolves coop org from original and fixed Tyúktartás on parent leg', () => {
    const coop = { documentId: 'org-coop', name: '2025 alom' };
    const tyuk = { documentId: 'org-tyuk', name: 'Tyúktartás' };
    const egg = { documentId: 'cur-egg', code: 'EGG' };
    const wf: WorkflowTemplate = {
      documentId: 'wf-egg',
      name: 'Tojás keletkezése',
      debit_account_code: 1300,
      credit_account_code: 4500,
      step: [
        {
          __component: STEP_RELATED,
          description: 'Napi tojás',
          percent: 100,
          debit_account: account('1300'),
          credit_account: account('4500'),
          currency_type: egg,
          transaction_type: typeTransfer,
          organization_from_original: true,
        },
        {
          __component: STEP_RELATED,
          description: 'Készlet átvezetés (ól)',
          percent: 100,
          debit_account: account('4500'),
          credit_account: account('1300'),
          currency_type: egg,
          transaction_type: typeTransfer,
          organization_from_original: true,
        },
        {
          __component: STEP_RELATED,
          description: 'Készlet átvezetés (központi)',
          percent: 100,
          debit_account: account('1300'),
          credit_account: account('4500'),
          currency_type: egg,
          transaction_type: typeTransfer,
          organization: tyuk,
        },
      ],
    };
    const tx: SourceTransaction = {
      documentId: 'tx-egg',
      date: '2026-10-01',
      amount: 12,
      description: 'Napi tojás',
      debit_account: account('1300'),
      credit_account: account('4500'),
      currency_type: egg,
      organization: coop,
    };
    const expanded = expandWorkflowSteps(wf, tx, new Map());
    assert.equal(expanded.length, 3);
    assert.equal(expanded[0]?.organization?.documentId, coop.documentId);
    assert.equal(expanded[1]?.organization?.documentId, coop.documentId);
    assert.equal(expanded[2]?.organization?.documentId, tyuk.documentId);
  });
});
