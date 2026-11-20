import { describe, expect, it } from 'vitest';

import type { AccountChoice } from './accountCodes';
import type { WorkflowTemplateHeader } from './transactionList';
import {
  buildWorkflowSamplePreviewInput,
  pickAccountForWorkflowPattern,
  sampleAmountForWorkflow,
  WORKFLOW_SAMPLE_DESCRIPTION,
} from './workflowOverviewSample';

const accounts: AccountChoice[] = [
  { id: 'acc-debit', code: '5410', name: 'Költség' },
  { id: 'acc-credit', code: '1520', name: 'Készlet' },
  { id: 'acc-member', code: '3810', name: 'Tagi' },
];

const hufWorkflow: WorkflowTemplateHeader = {
  documentId: 'wf-huf',
  name: 'HUF sablon',
  debit_account_code: '5410',
  credit_account_code: '1520',
  currency_type: {
    documentId: 'cur-huf',
    code: 'HUF',
    name: 'Forint',
  },
  transaction_type: { documentId: 'tt-1', name: 'Általános' },
  requires_source_organization: false,
};

const eggWorkflow: WorkflowTemplateHeader = {
  documentId: 'wf-egg',
  name: 'Tojás',
  debit_account_code: '5410',
  credit_account_code: '3810',
  currency_type: {
    documentId: 'cur-egg',
    code: 'db',
    name: 'Darab / tojás',
  },
  transaction_type: null,
  requires_source_organization: true,
};

describe('sampleAmountForWorkflow', () => {
  it('uses 100 000 Ft for money workflows', () => {
    expect(sampleAmountForWorkflow(hufWorkflow)).toBe(100_000);
  });

  it('uses 100 units for quantity-like currencies', () => {
    expect(sampleAmountForWorkflow(eggWorkflow)).toBe(100);
  });
});

describe('pickAccountForWorkflowPattern', () => {
  it('matches wildcard and exact patterns', () => {
    expect(pickAccountForWorkflowPattern(accounts, '5410')?.id).toBe(
      'acc-debit',
    );
    expect(pickAccountForWorkflowPattern(accounts, '3810')?.id).toBe(
      'acc-member',
    );
    expect(pickAccountForWorkflowPattern(accounts, '15?0')?.id).toBe(
      'acc-credit',
    );
  });
});

describe('buildWorkflowSamplePreviewInput', () => {
  it('builds inline convert-preview payload for a money workflow', () => {
    const result = buildWorkflowSamplePreviewInput(hufWorkflow, accounts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.previewInput.workflowDocumentId).toBe('wf-huf');
    const tx = result.previewInput.transaction;
    expect(tx?.amount).toBe(100_000);
    expect(tx?.description).toBe(WORKFLOW_SAMPLE_DESCRIPTION);
    expect(tx?.debit_account.documentId).toBe('acc-debit');
    expect(tx?.credit_account.documentId).toBe('acc-credit');
    expect(tx?.currency_type.documentId).toBe('cur-huf');
    expect(tx?.transaction_type?.documentId).toBe('tt-1');
    expect(tx?.organization).toBeNull();
  });

  it('requires organization when the workflow copies org from source', () => {
    const withoutOrg = buildWorkflowSamplePreviewInput(eggWorkflow, accounts);
    expect(withoutOrg).toEqual({ ok: false, reason: 'missing_organization' });

    const withOrg = buildWorkflowSamplePreviewInput(eggWorkflow, accounts, {
      organization: { documentId: 'org-1', name: 'Kör' },
    });
    expect(withOrg.ok).toBe(true);
    if (!withOrg.ok) return;
    expect(withOrg.previewInput.transaction?.amount).toBe(100);
    expect(withOrg.previewInput.transaction?.organization?.documentId).toBe(
      'org-1',
    );
  });

  it('fails when accounts do not match template patterns', () => {
    const sparseWorkflow: WorkflowTemplateHeader = {
      ...hufWorkflow,
      debit_account_code: '9999',
    };
    expect(buildWorkflowSamplePreviewInput(sparseWorkflow, accounts)).toEqual({
      ok: false,
      reason: 'missing_accounts',
    });
  });
});
