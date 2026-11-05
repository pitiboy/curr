import { receiptCardInvalid } from '../../data/receiptDraft';

import {
  TRANSACTION_DRAFT_REQUIRED,
  TRANSACTION_PUBLISH_REQUIRED,
  transactionFormErrors,
  transactionPublishFormErrors,
} from './transactionForm';

export type FormIssue = {
  level: 'error' | 'warning';
  message: string;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Red when any error; yellow when only warnings (or none). */
export function formIssueTone(errorCount: number): 'error' | 'warning' {
  return errorCount > 0 ? 'error' : 'warning';
}

export function formIssueCounts(issues: FormIssue[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.level === 'error') errors += 1;
    else warnings += 1;
  }
  return { errors, warnings };
}

function labeledFieldErrors(
  formErrors: Record<string, string>,
  fields: readonly string[],
  translate: Translate,
): FormIssue[] {
  const issues: FormIssue[] = [];
  for (const field of fields) {
    const message = formErrors[field];
    if (!message) continue;
    const label = translate(`resources.transactions.fields.${field}`);
    issues.push({
      level: 'error',
      message: `${label}: ${translate(message)}`,
    });
  }
  return issues;
}

function isBlankAccount(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return !value.trim();
  return false;
}

const CREATE_ACCOUNT_SUGGESTIONS = ['debit_account', 'credit_account'] as const;

/**
 * Create draft: draft quartet + invalid receipt cards as errors;
 * empty accounts / no file as soft warnings (accounts only required at review).
 */
export function collectCreateIssues(
  values: Record<string, unknown>,
  receiptCards: Array<{
    file: File | null;
    vendor: string;
    receiptTypeId: string;
  }>,
  translate: Translate,
): FormIssue[] {
  const formErrors = transactionFormErrors(values, receiptCards, translate);
  const issues = labeledFieldErrors(
    formErrors,
    TRANSACTION_DRAFT_REQUIRED,
    translate,
  );
  if (formErrors.receipt_cards) {
    issues.push({
      level: 'error',
      message: formErrors.receipt_cards,
    });
  }
  for (const field of CREATE_ACCOUNT_SUGGESTIONS) {
    if (!isBlankAccount(values[field])) continue;
    const label = translate(`resources.transactions.fields.${field}`);
    issues.push({
      level: 'warning',
      message: translate('app.transactions_create_account_suggested', {
        field: label,
      }),
    });
  }
  const hasReceiptFile = receiptCards.some(
    (card) => card.file != null && card.file.size > 0,
  );
  if (!hasReceiptFile && !receiptCards.some(receiptCardInvalid)) {
    issues.push({
      level: 'warning',
      message: translate('app.transactions_create_no_receipt'),
    });
  }
  return issues;
}

/**
 * Editor finalize: publish fields / pending receipt / same-person as errors;
 * no receipt as warning.
 */
export function collectFinalizeIssues(
  values: Record<string, unknown>,
  {
    blocked,
    missingReceipt,
    samePersonBlocked,
  }: {
    blocked: boolean;
    missingReceipt: boolean;
    samePersonBlocked: boolean;
  },
  translate: Translate,
): FormIssue[] {
  const issues = labeledFieldErrors(
    transactionPublishFormErrors(values, translate),
    TRANSACTION_PUBLISH_REQUIRED,
    translate,
  );
  if (blocked) {
    issues.push({
      level: 'error',
      message: translate('app.transactions_finalize_pending'),
    });
  }
  if (samePersonBlocked) {
    issues.push({
      level: 'error',
      message: translate('app.transactions_finalize_same_person'),
    });
  }
  if (missingReceipt) {
    issues.push({
      level: 'warning',
      message: translate('app.transactions_finalize_no_receipt'),
    });
  }
  return issues;
}
