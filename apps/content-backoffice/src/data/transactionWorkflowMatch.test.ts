import { describe, expect, it } from 'vitest';

import {
  matchingWorkflows,
  pickMatchingWorkflow,
  workflowMatchesTransaction,
  type WorkflowMatchSubject,
  type WorkflowTemplate,
} from './transactionList';

const ingatlan: WorkflowTemplate = {
  documentId: 'wf-ingatlan',
  name: 'Ügylet 1 — tagi ingatlan befizetés',
  debit_account_code: 1520,
  credit_account_code: 1101,
};

const trx = (
  overrides: Partial<WorkflowMatchSubject> = {},
): WorkflowMatchSubject => ({
  debit_account: { code: '1520' },
  credit_account: { code: '1101' },
  currency_type: { documentId: 'huf' },
  transaction_type: null,
  converted_to_workflow: false,
  ...overrides,
});

describe('workflowMatchesTransaction', () => {
  it('matches 1520 / 1101 on an unconverted row (account code as string)', () => {
    expect(workflowMatchesTransaction(ingatlan, trx())).toBe(true);
  });

  it('accepts numeric codes and a missing converted flag', () => {
    expect(
      workflowMatchesTransaction(
        ingatlan,
        trx({
          debit_account: { code: 1520 },
          credit_account: { code: 1101 },
          converted_to_workflow: undefined,
        }),
      ),
    ).toBe(true);
  });

  it('never matches a converted row', () => {
    expect(
      workflowMatchesTransaction(
        ingatlan,
        trx({ converted_to_workflow: true }),
      ),
    ).toBe(false);
  });

  it('needs both account codes to match', () => {
    expect(
      workflowMatchesTransaction(
        ingatlan,
        trx({ debit_account: { code: '1530' } }),
      ),
    ).toBe(false);
    expect(
      workflowMatchesTransaction(
        ingatlan,
        trx({ credit_account: { code: '1001' } }),
      ),
    ).toBe(false);
    expect(
      workflowMatchesTransaction(ingatlan, trx({ debit_account: null })),
    ).toBe(false);
    expect(
      workflowMatchesTransaction(
        ingatlan,
        trx({ credit_account: { code: '' } }),
      ),
    ).toBe(false);
  });

  it('narrows by template currency', () => {
    const hufOnly = { ...ingatlan, currency_type: { documentId: 'huf' } };
    expect(workflowMatchesTransaction(hufOnly, trx())).toBe(true);
    expect(
      workflowMatchesTransaction(
        hufOnly,
        trx({ currency_type: { documentId: 'eur' } }),
      ),
    ).toBe(false);
    expect(
      workflowMatchesTransaction(hufOnly, trx({ currency_type: null })),
    ).toBe(false);
  });

  it('ignores the currency when the template has none', () => {
    expect(
      workflowMatchesTransaction(
        ingatlan,
        trx({ currency_type: { documentId: 'eur' } }),
      ),
    ).toBe(true);
  });

  it('narrows by template type: an empty transaction type does not match', () => {
    const typed = { ...ingatlan, transaction_type: { documentId: 'utalas' } };
    expect(workflowMatchesTransaction(typed, trx())).toBe(false);
    expect(
      workflowMatchesTransaction(
        typed,
        trx({ transaction_type: { documentId: 'utalas' } }),
      ),
    ).toBe(true);
    expect(
      workflowMatchesTransaction(
        typed,
        trx({ transaction_type: { documentId: 'keszpenz' } }),
      ),
    ).toBe(false);
  });
});

describe('pickMatchingWorkflow', () => {
  const other: WorkflowTemplate = {
    documentId: 'wf-other',
    name: 'Más ügylet',
    debit_account_code: 5000,
    credit_account_code: 1100,
  };

  it('returns the single matching template', () => {
    expect(pickMatchingWorkflow([other, ingatlan], trx())).toBe(ingatlan);
  });

  it('returns null without a match', () => {
    expect(pickMatchingWorkflow([other], trx())).toBeNull();
    expect(pickMatchingWorkflow([], trx())).toBeNull();
  });

  it('returns null when a converted row would otherwise match', () => {
    expect(
      pickMatchingWorkflow([ingatlan], trx({ converted_to_workflow: true })),
    ).toBeNull();
  });

  it('returns null when several templates match (the server answers 409)', () => {
    const twin = { ...ingatlan, documentId: 'wf-twin', name: 'Ikersablon' };
    expect(pickMatchingWorkflow([ingatlan, twin], trx())).toBeNull();
    expect(matchingWorkflows([ingatlan, twin], trx())).toHaveLength(2);
  });

  it('lets a currency-typed twin disambiguate', () => {
    const eurOnly = {
      ...ingatlan,
      documentId: 'wf-eur',
      currency_type: { documentId: 'eur' },
    };
    expect(pickMatchingWorkflow([ingatlan, eurOnly], trx())).toBe(ingatlan);
  });
});
