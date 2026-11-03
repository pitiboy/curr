import { describe, expect, it } from 'vitest';

import type { AccountChoice } from './accountCodes';
import {
  buildAccountRowOptions,
  decodeAccountRowSelectValue,
  encodeAccountRowSelectValue,
  PROFILE_OPTION_PREFIX,
  resolveAccountCodeToAccount,
  resolveAccountRowSelection,
  resolveCreateWorkflow,
  resolveWorkflowPrefill,
  WORKFLOW_OPTION_PREFIX,
} from './accountRowSelection';
import { selectableAccountProfilesWithAll } from './accountProfiles';
import type { WorkflowTemplateHeader } from './transactionList';

const accounts: AccountChoice[] = [
  { id: 'a1', code: '1101', name: 'Bank' },
  { id: 'a2', code: '1101', name: 'Bank duplicate' },
  { id: 'd1', code: '5200', name: 'Cost' },
];

const workflowA: WorkflowTemplateHeader = {
  documentId: 'wf-a',
  name: 'Alpha',
  debit_account_code: 5200,
  credit_account_code: 1101,
};

const workflowB: WorkflowTemplateHeader = {
  documentId: 'wf-b',
  name: 'Beta',
  debit_account_code: 5200,
  credit_account_code: 1101,
};

const labels = {
  groupProfiles: 'Profilok',
  groupWorkflows: 'Sablonok',
  workflowsLoading: 'Loading…',
  workflowSecondary: (w: WorkflowTemplateHeader) =>
    `${w.debit_account_code} ← ${w.credit_account_code}`,
};

describe('account row select encode/decode', () => {
  it('round-trips profile and workflow values', () => {
    const profile = encodeAccountRowSelectValue({
      kind: 'profile',
      profile: 'cost',
    });
    expect(profile).toBe(`${PROFILE_OPTION_PREFIX}cost`);
    expect(decodeAccountRowSelectValue(profile)).toEqual({
      kind: 'profile',
      profile: 'cost',
    });

    const workflow = encodeAccountRowSelectValue({
      kind: 'workflow',
      workflowDocumentId: 'doc-1',
    });
    expect(workflow).toBe(`${WORKFLOW_OPTION_PREFIX}doc-1`);
    expect(decodeAccountRowSelectValue(workflow)).toEqual({
      kind: 'workflow',
      workflowDocumentId: 'doc-1',
    });
  });

  it('returns null for unknown select values', () => {
    expect(decodeAccountRowSelectValue('egg-sale')).toBeNull();
    expect(decodeAccountRowSelectValue(`${WORKFLOW_OPTION_PREFIX}`)).toBeNull();
  });
});

describe('buildAccountRowOptions', () => {
  it('lists profiles in gated order and sorts workflows by Hungarian name', () => {
    const profiles = selectableAccountProfilesWithAll([], true);
    const options = buildAccountRowOptions(
      profiles,
      [workflowB, workflowA],
      labels,
    );
    const profileValues = options
      .filter((row) => row.kind === 'profile')
      .map((row) => row.value);
    expect(profileValues[0]).toBe(`${PROFILE_OPTION_PREFIX}`);
    expect(profileValues[1]).toBe(`${PROFILE_OPTION_PREFIX}cost`);

    const workflowNames = options
      .filter((row) => row.kind === 'workflow')
      .map((row) => (row.kind === 'workflow' ? row.label : ''));
    expect(workflowNames).toEqual(['Alpha', 'Beta']);
  });

  it('adds a disabled loading row without templates', () => {
    const options = buildAccountRowOptions(['', 'cost'], [], labels, {
      workflowsLoading: true,
    });
    expect(options.some((row) => row.kind === 'workflows-loading')).toBe(true);
    expect(options.some((row) => row.kind === 'workflow')).toBe(false);
  });

  it('omits workflow group rows when empty and not loading', () => {
    const options = buildAccountRowOptions(['cost'], [], labels);
    expect(options.every((row) => row.kind === 'profile')).toBe(true);
  });
});

describe('resolveWorkflowPrefill', () => {
  it('fills currency and transaction type only when set on the template', () => {
    const result = resolveWorkflowPrefill(
      {
        ...workflowA,
        currency_type: { documentId: 'cur-huf' },
        transaction_type: null,
      },
      [{ id: 'd-only', code: '5200', name: 'Cost' }, accounts[0]!],
    );
    expect(result.debitAccountId).toBe('d-only');
    expect(result.creditAccountId).toBe('a1');
    expect(result.currencyTypeId).toBe('cur-huf');
    expect(result.transactionTypeId).toBeNull();
    expect(result.accountsResolved).toBe(true);
  });

  it('warns and skips guess on ambiguous account codes', () => {
    const result = resolveWorkflowPrefill(workflowA, accounts);
    expect(result.creditAccountId).toBeNull();
    expect(result.debitAccountId).toBe('d1');
    expect(result.accountsResolved).toBe(false);
    expect(result.warningKeys).toContain(
      'app.account_profile_workflow_prefill_incomplete',
    );
  });
});

describe('resolveAccountCodeToAccount', () => {
  it('detects missing and ambiguous codes', () => {
    expect(resolveAccountCodeToAccount(accounts, 9999)).toEqual({
      status: 'missing',
    });
    expect(resolveAccountCodeToAccount(accounts, 1101)).toEqual({
      status: 'ambiguous',
      ids: ['a1', 'a2'],
    });
  });
});

describe('resolveAccountRowSelection', () => {
  const matchInput = {
    converted_to_workflow: null,
    debit_account: { code: '5200' },
    credit_account: { code: '1101' },
    currency_type: null,
    transaction_type: null,
  };

  it('keeps an active workflow while form values still match', () => {
    const resolved = resolveAccountRowSelection({
      storedSelection: { kind: 'workflow', workflowDocumentId: 'wf-a' },
      lastProfile: 'cost',
      workflows: [workflowA],
      matchInput,
      prefillAccountsResolved: true,
    });
    expect(resolved.activeWorkflow?.documentId).toBe('wf-a');
    expect(resolved.filterProfile).toBe('');
  });

  it('falls back to the last profile after account edits break the match', () => {
    const resolved = resolveAccountRowSelection({
      storedSelection: { kind: 'workflow', workflowDocumentId: 'wf-a' },
      lastProfile: 'cost',
      workflows: [workflowA],
      matchInput: {
        ...matchInput,
        debit_account: { code: '9999' },
      },
      prefillAccountsResolved: true,
    });
    expect(resolved.effectiveSelection).toEqual({
      kind: 'profile',
      profile: 'cost',
    });
    expect(resolved.workflowDropped).toBe(true);
    expect(resolved.activeWorkflow).toBeNull();
  });
});

describe('resolveCreateWorkflow', () => {
  const matchInput = {
    converted_to_workflow: null,
    debit_account: { code: '5200' },
    credit_account: { code: '1101' },
    currency_type: null,
    transaction_type: null,
  };

  it('prefers the selected template even when multiple templates share codes', () => {
    const resolution = resolveCreateWorkflow({
      activeWorkflow: workflowB,
      workflows: [workflowA, workflowB],
      matchInput,
    });
    expect(resolution.source).toBe('selected');
    expect(resolution.workflow?.documentId).toBe('wf-b');
  });

  it('uses matchFor semantics in profile mode', () => {
    const resolution = resolveCreateWorkflow({
      activeWorkflow: null,
      workflows: [workflowA, workflowB],
      matchInput,
    });
    expect(resolution.workflow).toBeNull();

    const unique = resolveCreateWorkflow({
      activeWorkflow: null,
      workflows: [workflowA],
      matchInput,
    });
    expect(unique.source).toBe('matched');
    expect(unique.workflow?.documentId).toBe('wf-a');
  });
});
