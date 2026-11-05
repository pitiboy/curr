import type { AccountChoice } from './accountCodes';
import type { AccountProfile } from './accountProfiles';
import {
  workflowMatchesTransaction,
  pickMatchingWorkflow,
  countMatchingWorkflows,
  type TransactionWorkflowMatchInput,
  type WorkflowTemplateHeader,
} from './transactionList';

export const PROFILE_OPTION_PREFIX = 'profile:' as const;
export const WORKFLOW_OPTION_PREFIX = 'workflow:' as const;

/** Roles that may load published transaction-workflow headers for Create prefill. */
export const TRANSACTION_WORKFLOW_PREFILL_ROLES = [
  'dataentry',
  'editor',
] as const;

export type TransactionWorkflowPrefillRole =
  (typeof TRANSACTION_WORKFLOW_PREFILL_ROLES)[number];

export type AccountRowSelection =
  | { kind: 'profile'; profile: AccountProfile }
  | { kind: 'workflow'; workflowDocumentId: string };

export type AccountRowOptionLabels = {
  groupProfiles: string;
  groupWorkflows: string;
  workflowsLoading: string;
  workflowSecondary: (workflow: WorkflowTemplateHeader) => string;
};

export type AccountRowSelectOption =
  | {
      kind: 'profile';
      value: string;
      profile: AccountProfile;
      labelKey: string;
    }
  | {
      kind: 'workflow';
      value: string;
      workflow: WorkflowTemplateHeader;
      label: string;
      secondary: string;
      /** Concrete currency code/name for the chip; null when unrestricted. */
      currencyChipLabel: string | null;
      /** Concrete transaction-type name for the chip; null when unrestricted. */
      transactionTypeChipLabel: string | null;
    }
  | {
      kind: 'workflows-loading';
      value: string;
      labelKey: string;
    };

export type ResolveAccountCodeResult =
  | { status: 'ok'; id: string }
  | { status: 'missing' }
  | { status: 'ambiguous'; ids: string[] };

export type WorkflowPrefillResult = {
  debitAccountId: string | null;
  creditAccountId: string | null;
  currencyTypeId: string | null;
  transactionTypeId: string | null;
  /** i18n keys for inline warnings (missing/ambiguous codes). */
  warningKeys: string[];
  /** False when account codes could not be resolved uniquely — not a guaranteed Convert match. */
  accountsResolved: boolean;
};

export type ResolvedAccountRowSelection = {
  /** Value shown in the Select control. */
  effectiveSelection: AccountRowSelection;
  /** User's last profile choice (for filtering when not in an active workflow). */
  filterProfile: AccountProfile;
  /** Set when the user picked a workflow but form values no longer match it. */
  workflowDropped: boolean;
  /** Active workflow selection (guaranteed match). */
  activeWorkflow: WorkflowTemplateHeader | null;
};

export type CreateWorkflowResolution =
  | {
      workflow: WorkflowTemplateHeader;
      source: 'selected';
    }
  | {
      workflow: WorkflowTemplateHeader;
      source: 'matched';
    }
  | { workflow: null; source: null };

export function profileLabelKey(profile: AccountProfile): string {
  if (profile === '') return 'app.account_profile_all';
  return `app.account_profile_${profile.replace(/-/g, '_')}`;
}

export function encodeAccountRowSelectValue(
  selection: AccountRowSelection,
): string {
  if (selection.kind === 'profile') {
    return `${PROFILE_OPTION_PREFIX}${selection.profile}`;
  }
  return `${WORKFLOW_OPTION_PREFIX}${selection.workflowDocumentId}`;
}

export function decodeAccountRowSelectValue(
  value: string,
): AccountRowSelection | null {
  if (value.startsWith(PROFILE_OPTION_PREFIX)) {
    return {
      kind: 'profile',
      profile: value.slice(PROFILE_OPTION_PREFIX.length) as AccountProfile,
    };
  }
  if (value.startsWith(WORKFLOW_OPTION_PREFIX)) {
    const workflowDocumentId = value.slice(WORKFLOW_OPTION_PREFIX.length);
    if (!workflowDocumentId) return null;
    return { kind: 'workflow', workflowDocumentId };
  }
  return null;
}

export function workflowTemplateSecondaryText(
  workflow: WorkflowTemplateHeader,
): string {
  return `${workflow.credit_account_code} → ${workflow.debit_account_code}`;
}

export function workflowCurrencyChipLabel(
  workflow: WorkflowTemplateHeader,
): string | null {
  if (!workflow.currency_type?.documentId) return null;
  const code = workflow.currency_type.code?.trim();
  if (code) return code;
  const name = workflow.currency_type.name?.trim();
  return name || null;
}

export function workflowTransactionTypeChipLabel(
  workflow: WorkflowTemplateHeader,
): string | null {
  if (!workflow.transaction_type?.documentId) return null;
  const name = workflow.transaction_type.name?.trim();
  return name || null;
}

export function buildAccountRowOptions(
  profiles: AccountProfile[],
  workflows: WorkflowTemplateHeader[],
  labels: AccountRowOptionLabels,
  options?: { workflowsLoading?: boolean },
): AccountRowSelectOption[] {
  const rows: AccountRowSelectOption[] = profiles.map((profile) => ({
    kind: 'profile',
    value: encodeAccountRowSelectValue({ kind: 'profile', profile }),
    profile,
    labelKey: profileLabelKey(profile),
  }));

  if (options?.workflowsLoading) {
    rows.push({
      kind: 'workflows-loading',
      value: `${WORKFLOW_OPTION_PREFIX}__loading__`,
      labelKey: labels.workflowsLoading,
    });
    return rows;
  }

  if (workflows.length === 0) {
    return rows;
  }

  const sorted = [...workflows].sort((left, right) =>
    (left.name ?? left.documentId).localeCompare(
      right.name ?? right.documentId,
      'hu',
    ),
  );

  for (const workflow of sorted) {
    rows.push({
      kind: 'workflow',
      value: encodeAccountRowSelectValue({
        kind: 'workflow',
        workflowDocumentId: workflow.documentId,
      }),
      workflow,
      label: workflow.name?.trim() || workflow.documentId,
      secondary: labels.workflowSecondary(workflow),
      currencyChipLabel: workflowCurrencyChipLabel(workflow),
      transactionTypeChipLabel: workflowTransactionTypeChipLabel(workflow),
    });
  }

  return rows;
}

export function resolveAccountCodeToAccount(
  accounts: AccountChoice[],
  code: number,
): ResolveAccountCodeResult {
  const codeString = String(code);
  const matches = accounts.filter(
    (account) => String(account.code).trim() === codeString,
  );
  if (matches.length === 0) return { status: 'missing' };
  if (matches.length > 1) {
    return {
      status: 'ambiguous',
      ids: matches.map((row) => String(row.id)),
    };
  }
  return { status: 'ok', id: String(matches[0]!.id) };
}

export function resolveWorkflowPrefill(
  workflow: WorkflowTemplateHeader,
  accounts: AccountChoice[],
): WorkflowPrefillResult {
  const warningKeys: string[] = [];
  const debit = resolveAccountCodeToAccount(
    accounts,
    workflow.debit_account_code,
  );
  const credit = resolveAccountCodeToAccount(
    accounts,
    workflow.credit_account_code,
  );

  let debitAccountId: string | null = null;
  let creditAccountId: string | null = null;
  let accountsResolved = true;

  if (debit.status === 'ok') {
    debitAccountId = debit.id;
  } else {
    accountsResolved = false;
    warningKeys.push('app.account_profile_workflow_prefill_incomplete');
  }
  if (credit.status === 'ok') {
    creditAccountId = credit.id;
  } else {
    accountsResolved = false;
    if (
      !warningKeys.includes('app.account_profile_workflow_prefill_incomplete')
    ) {
      warningKeys.push('app.account_profile_workflow_prefill_incomplete');
    }
  }

  const currencyTypeId = workflow.currency_type?.documentId?.trim()
    ? workflow.currency_type.documentId
    : null;
  const transactionTypeId = workflow.transaction_type?.documentId?.trim()
    ? workflow.transaction_type.documentId
    : null;

  return {
    debitAccountId,
    creditAccountId,
    currencyTypeId,
    transactionTypeId,
    warningKeys,
    accountsResolved,
  };
}

export function buildTransactionWorkflowMatchInput(params: {
  accounts: AccountChoice[];
  debitAccountDocumentId: unknown;
  creditAccountDocumentId: unknown;
  currencyTypeDocumentId: unknown;
  transactionTypeDocumentId?: unknown;
}): TransactionWorkflowMatchInput {
  const debitCode = accountCodeByDocumentId(
    params.accounts,
    params.debitAccountDocumentId,
  );
  const creditCode = accountCodeByDocumentId(
    params.accounts,
    params.creditAccountDocumentId,
  );
  return {
    converted_to_workflow: null,
    debit_account: debitCode ? { code: debitCode } : null,
    credit_account: creditCode ? { code: creditCode } : null,
    currency_type:
      typeof params.currencyTypeDocumentId === 'string' &&
      params.currencyTypeDocumentId.trim()
        ? { documentId: params.currencyTypeDocumentId.trim() }
        : null,
    transaction_type:
      typeof params.transactionTypeDocumentId === 'string' &&
      params.transactionTypeDocumentId.trim()
        ? { documentId: params.transactionTypeDocumentId.trim() }
        : null,
  };
}

function accountCodeByDocumentId(
  accounts: AccountChoice[],
  documentId: unknown,
): string | null {
  if (typeof documentId !== 'string' || !documentId.trim()) return null;
  const row = accounts.find((account) => String(account.id) === documentId);
  const code = row?.code;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}

function parseLedgerAccountCode(
  code: string | number | null | undefined,
): number | null {
  if (code === null || code === undefined || code === '') return null;
  const value = Number(code);
  return Number.isFinite(value) ? value : null;
}

export function findWorkflowByDocumentId(
  workflows: WorkflowTemplateHeader[],
  documentId: string,
): WorkflowTemplateHeader | null {
  return workflows.find((row) => row.documentId === documentId) ?? null;
}

export function resolveAccountRowSelection(params: {
  storedSelection: AccountRowSelection;
  lastProfile: AccountProfile;
  workflows: WorkflowTemplateHeader[];
  matchInput: TransactionWorkflowMatchInput;
  prefillAccountsResolved?: boolean;
}): ResolvedAccountRowSelection {
  const { storedSelection, lastProfile, workflows, matchInput } = params;
  const prefillOk = params.prefillAccountsResolved !== false;

  if (storedSelection.kind === 'profile') {
    return {
      effectiveSelection: storedSelection,
      filterProfile: storedSelection.profile,
      workflowDropped: false,
      activeWorkflow: null,
    };
  }

  const workflow = findWorkflowByDocumentId(
    workflows,
    storedSelection.workflowDocumentId,
  );
  if (!workflow) {
    return {
      effectiveSelection: { kind: 'profile', profile: lastProfile },
      filterProfile: lastProfile,
      workflowDropped: true,
      activeWorkflow: null,
    };
  }

  const debitCode = parseLedgerAccountCode(
    matchInput.debit_account?.code ?? null,
  );
  const creditCode = parseLedgerAccountCode(
    matchInput.credit_account?.code ?? null,
  );
  if (debitCode === null || creditCode === null) {
    return {
      effectiveSelection: storedSelection,
      filterProfile: '',
      workflowDropped: false,
      activeWorkflow: null,
    };
  }

  if (!workflowMatchesTransaction(workflow, matchInput)) {
    return {
      effectiveSelection: { kind: 'profile', profile: lastProfile },
      filterProfile: lastProfile,
      workflowDropped: true,
      activeWorkflow: null,
    };
  }

  if (!prefillOk) {
    return {
      effectiveSelection: storedSelection,
      filterProfile: '',
      workflowDropped: false,
      activeWorkflow: null,
    };
  }

  return {
    effectiveSelection: storedSelection,
    filterProfile: '',
    workflowDropped: false,
    activeWorkflow: workflow,
  };
}

export function resolveCreateWorkflow(params: {
  activeWorkflow: WorkflowTemplateHeader | null;
  workflows: WorkflowTemplateHeader[];
  matchInput: TransactionWorkflowMatchInput;
}): CreateWorkflowResolution {
  if (params.activeWorkflow) {
    return { workflow: params.activeWorkflow, source: 'selected' };
  }
  const matched = pickMatchingWorkflow(params.workflows, params.matchInput);
  if (matched) {
    return { workflow: matched, source: 'matched' };
  }
  return { workflow: null, source: null };
}

export function profileModeMatchCount(
  workflows: WorkflowTemplateHeader[],
  matchInput: TransactionWorkflowMatchInput,
): number {
  return countMatchingWorkflows(workflows, matchInput);
}
