/**
 * Convert preview DTO (pure logic, no Strapi).
 * Reuses expandWorkflowSteps and storno rules from convert.ts.
 */
import {
  accountCodeString,
  buildStornoRowShape,
  expandWorkflowSteps,
  isExpandableConvertedValue,
  isMemberAccountCode,
  pickMatchingWorkflow,
  TransactionWorkflowError,
  type AccountRef,
  type ExpandedStepRow,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert';

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

function accountPairKey(debit: AccountRef, credit: AccountRef): string | null {
  const debitKey = accountCodeString(debit) ?? debit.documentId;
  const creditKey = accountCodeString(credit) ?? credit.documentId;
  if (!debitKey || !creditKey) return null;
  return `${debitKey}:${creditKey}`;
}

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

  const percentSumByPair = new Map<string, number>();
  for (const row of expanded) {
    const percent = stepPercent(workflow, row.index);
    if (percent == null) continue;
    const key = accountPairKey(row.debit_account, row.credit_account);
    if (!key) continue;
    percentSumByPair.set(key, (percentSumByPair.get(key) ?? 0) + percent);
  }
  for (const sum of percentSumByPair.values()) {
    if (Math.abs(sum - 100) > 0.0001) {
      warnings.push(PERCENT_SUM_WARNING);
      break;
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
  };
}

export function buildConvertPreview(
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
  siblingByCode: ReadonlyMap<string, AccountRef>,
  accountLookup: AccountMetaLookup,
  currencyLookup: CurrencyMetaLookup,
): ConvertPreview {
  if (!isExpandableConvertedValue(transaction.converted_to_workflow)) {
    throw new TransactionWorkflowError(
      'Transaction is already converted and cannot be previewed',
      422,
    );
  }

  const expanded = expandWorkflowSteps(workflow, transaction, siblingByCode);
  const keepOriginal = workflow.keep_original !== false;
  const sourceAmount = Number(transaction.amount);
  const warnings = collectPreviewWarnings(
    keepOriginal,
    transaction,
    expanded,
    workflow,
  );

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

export function previewForTransaction(
  workflows: WorkflowTemplate[],
  transaction: SourceTransaction,
  siblingByCode: ReadonlyMap<string, AccountRef>,
  accountLookup: AccountMetaLookup,
  currencyLookup: CurrencyMetaLookup,
  workflowDocumentId?: string,
): ConvertPreview {
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

  return buildConvertPreview(
    workflow,
    transaction,
    siblingByCode,
    accountLookup,
    currencyLookup,
  );
}

export { isMemberAccountCode };
