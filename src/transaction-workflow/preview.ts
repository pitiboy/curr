/**
 * Convert preview DTO (pure logic, no Strapi).
 * Reuses expandWorkflowSteps and storno rules from convert.ts.
 */
import {
  buildStornoRowShape,
  expandWorkflowSteps,
  isExpandableConvertedValue,
  isMemberAccountCode,
  pickMatchingWorkflow,
  stepAmount,
  TransactionWorkflowError,
  type AccountRef,
  type AppliedRate,
  type ExpandedStepRow,
  type RateByCurrency,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert';
import {
  membershipRatioWarning,
  type MembershipRatioIssue,
} from './membership-ratio';

export const PREVIEW_INLINE_DOCUMENT_ID = '__convert-preview-inline__';

export type PreviewAccount = {
  documentId: string;
  code: string;
  name: string | null;
};

export type PreviewCurrency = {
  documentId: string;
  code: string | null;
  name: string | null;
};

export type PreviewMovementKind = 'original' | 'storno' | 'step';

export type PreviewMovement = {
  kind: 'storno' | 'step';
  index: number | null;
  description: string;
  amount: number;
  currency: PreviewCurrency;
  debit: PreviewAccount;
  credit: PreviewAccount;
  percent: number | null;
  copyReceipt: boolean;
  organizationDocumentId: string | null;
  /** apply_currency_rate steps only; null otherwise (and on storno). */
  rate: AppliedRate | null;
};

/** Strapi-resolved inputs for apply_currency_rate templates. */
export type PreviewRateContext = {
  rates?: RateByCurrency;
  membershipRatioIssues?: readonly MembershipRatioIssue[];
};

export type ConvertPreview = {
  workflow: {
    documentId: string;
    name: string | null;
    keepOriginal: boolean;
    stepsPublished: boolean;
  };
  original: {
    amount: number;
    currency: PreviewCurrency;
    debit: PreviewAccount;
    credit: PreviewAccount;
    description: string;
  };
  movements: PreviewMovement[];
  warnings: string[];
};

export type AccountMetaLookup = ReadonlyMap<
  string,
  { code: string; name: string | null }
>;

export type CurrencyMetaLookup = ReadonlyMap<
  string,
  { code: string | null; name: string | null }
>;

const RECEIPT_WARNING =
  'Source transaction has receipts but no step sets copy_receipt';
const PERCENT_SUM_WARNING =
  'Step percentages do not sum to 100% of the original amount';

function requireAccountMeta(
  account: AccountRef | null | undefined,
  lookup: AccountMetaLookup,
  label: string,
): PreviewAccount {
  const documentId = account?.documentId;
  if (!documentId) {
    throw new TransactionWorkflowError(`${label} account is missing`, 422);
  }
  const fromLookup = lookup.get(documentId);
  const code =
    fromLookup?.code ?? (account?.code != null ? String(account.code) : null);
  if (!code) {
    throw new TransactionWorkflowError(`${label} account code is missing`, 422);
  }
  return {
    documentId,
    code,
    name: fromLookup?.name ?? null,
  };
}

/** Merge Strapi currency rows without wiping an already-resolved code. */
export function mergeCurrencyLookupRow(
  existing: { code: string | null; name: string | null } | undefined,
  incoming: { code?: string | null; name?: string | null },
): { code: string | null; name: string | null } {
  return {
    code: incoming.code ?? existing?.code ?? null,
    name: incoming.name ?? existing?.name ?? null,
  };
}

function currencyMeta(
  documentId: string,
  lookup: CurrencyMetaLookup,
): PreviewCurrency {
  const row = lookup.get(documentId);
  return {
    documentId,
    code: row?.code ?? null,
    name: row?.name ?? null,
  };
}

function stepPercent(workflow: WorkflowTemplate, index: number): number | null {
  const step = workflow.step?.[index];
  if (!step) return null;
  const raw = step.percent;
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function collectPreviewWarnings(
  keepOriginal: boolean,
  transaction: SourceTransaction,
  expanded: ExpandedStepRow[],
  workflow: WorkflowTemplate,
  sourceAmount: number,
): string[] {
  const warnings: string[] = [];
  const hasReceipts = (transaction.receipts?.length ?? 0) > 0;
  if (
    !keepOriginal &&
    hasReceipts &&
    !expanded.some((row) => row.copy_receipt)
  ) {
    warnings.push(RECEIPT_WARNING);
  }

  const percents = (workflow.step ?? [])
    .map((step) => Number(step.percent))
    .filter((value) => Number.isFinite(value));
  if (percents.length > 0) {
    const sum = percents.reduce((total, value) => total + value, 0);
    const stepsTotal = expanded.reduce((total, row) => total + row.amount, 0);
    const expectedTotal = stepAmount(sourceAmount, sum);
    if (Math.abs(sum - 100) > 0.0001) {
      warnings.push(PERCENT_SUM_WARNING);
    } else if (Math.abs(stepsTotal - expectedTotal) > 0.01) {
      warnings.push(PERCENT_SUM_WARNING);
    }
  }

  return warnings;
}

function movementFromStepRow(
  row: ExpandedStepRow,
  workflow: WorkflowTemplate,
  accountLookup: AccountMetaLookup,
  currencyLookup: CurrencyMetaLookup,
): PreviewMovement {
  return {
    kind: 'step',
    index: row.index,
    description: row.description,
    amount: row.amount,
    currency: currencyMeta(row.currency_type.documentId, currencyLookup),
    debit: requireAccountMeta(row.debit_account, accountLookup, 'Step debit'),
    credit: requireAccountMeta(
      row.credit_account,
      accountLookup,
      'Step credit',
    ),
    percent: stepPercent(workflow, row.index),
    copyReceipt: row.copy_receipt,
    organizationDocumentId: row.organization?.documentId ?? null,
    rate: row.appliedRate,
  };
}

function stornoMovement(
  storno: ReturnType<typeof buildStornoRowShape>,
  accountLookup: AccountMetaLookup,
  currencyLookup: CurrencyMetaLookup,
): PreviewMovement {
  return {
    kind: 'storno',
    index: null,
    description: storno.description?.trim() ?? '',
    amount: storno.amount,
    currency: currencyMeta(storno.currency_type.documentId, currencyLookup),
    debit: requireAccountMeta(
      storno.debit_account,
      accountLookup,
      'Storno debit',
    ),
    credit: requireAccountMeta(
      storno.credit_account,
      accountLookup,
      'Storno credit',
    ),
    percent: null,
    copyReceipt: false,
    organizationDocumentId: storno.organization?.documentId ?? null,
    rate: null,
  };
}

export function buildConvertPreview(
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
  siblingByCode: ReadonlyMap<string, AccountRef>,
  accountLookup: AccountMetaLookup,
  currencyLookup: CurrencyMetaLookup,
  rateContext: PreviewRateContext = {},
): ConvertPreview {
  if (!isExpandableConvertedValue(transaction.converted_to_workflow)) {
    throw new TransactionWorkflowError(
      'Transaction is already converted and cannot be previewed',
      422,
    );
  }

  const expanded = expandWorkflowSteps(
    workflow,
    transaction,
    siblingByCode,
    rateContext.rates,
  );
  const keepOriginal = workflow.keep_original !== false;
  const sourceAmount = Number(transaction.amount);
  const warnings = collectPreviewWarnings(
    keepOriginal,
    transaction,
    expanded,
    workflow,
    sourceAmount,
  );
  const ratioWarning = membershipRatioWarning(
    rateContext.membershipRatioIssues ?? [],
  );
  if (ratioWarning) warnings.push(ratioWarning);

  const originalCurrencyId = transaction.currency_type?.documentId;
  if (!originalCurrencyId) {
    throw new TransactionWorkflowError(
      'Source transaction currency_type is required for preview',
      422,
    );
  }

  const movements: PreviewMovement[] = [];
  if (keepOriginal) {
    movements.push(
      stornoMovement(
        buildStornoRowShape(transaction),
        accountLookup,
        currencyLookup,
      ),
    );
  }
  for (const row of expanded) {
    movements.push(
      movementFromStepRow(row, workflow, accountLookup, currencyLookup),
    );
  }

  return {
    workflow: {
      documentId: workflow.documentId,
      name: workflow.name ?? null,
      keepOriginal,
      stepsPublished: workflow.steps_published !== false,
    },
    original: {
      amount: sourceAmount,
      currency: currencyMeta(originalCurrencyId, currencyLookup),
      debit: requireAccountMeta(
        transaction.debit_account,
        accountLookup,
        'Original debit',
      ),
      credit: requireAccountMeta(
        transaction.credit_account,
        accountLookup,
        'Original credit',
      ),
      description: transaction.description?.trim() ?? '',
    },
    movements,
    warnings,
  };
}

/** Template the preview would use (404 when none / not found). */
export function selectPreviewWorkflow(
  workflows: WorkflowTemplate[],
  transaction: SourceTransaction,
  workflowDocumentId?: string,
): WorkflowTemplate {
  let candidates = workflows;
  if (workflowDocumentId) {
    candidates = workflows.filter(
      (row) => row.documentId === workflowDocumentId,
    );
    if (candidates.length === 0) {
      throw new TransactionWorkflowError(
        'Published transaction-workflow not found',
        404,
      );
    }
  }

  const workflow = pickMatchingWorkflow(candidates, transaction);
  if (!workflow) {
    throw new TransactionWorkflowError(
      'No published transaction-workflow template matches the transaction',
      404,
    );
  }
  return workflow;
}

export function previewForTransaction(
  workflows: WorkflowTemplate[],
  transaction: SourceTransaction,
  siblingByCode: ReadonlyMap<string, AccountRef>,
  accountLookup: AccountMetaLookup,
  currencyLookup: CurrencyMetaLookup,
  workflowDocumentId?: string,
  rateContext: PreviewRateContext = {},
): ConvertPreview {
  return buildConvertPreview(
    selectPreviewWorkflow(workflows, transaction, workflowDocumentId),
    transaction,
    siblingByCode,
    accountLookup,
    currencyLookup,
    rateContext,
  );
}

export { isMemberAccountCode };
