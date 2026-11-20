import type { AccountChoice } from './accountCodes';
import { normalizeAccountCode } from './accountCodes';
import type {
  ConvertPreviewRequest,
  InlinePreviewTransaction,
} from './convertPreview';
import {
  accountCodeMatchesPattern,
  type WorkflowTemplateHeader,
} from './transactionList';

/** After seeded FX rates (e.g. HEN→HUF validFrom 2026-09-11). */
const DEFAULT_SAMPLE_DATE = '2026-10-01';

/** Sample preview currency when the workflow template has no currency_type. */
export const WORKFLOW_SAMPLE_FALLBACK_CURRENCY_CODE = 'HUF' as const;

const QUANTITY_CURRENCY_HINTS = [
  'tojas',
  'tojás',
  'egg',
  'db',
  'darab',
  'ido',
  'idő',
  'time',
  'ora',
  'óra',
  'menny',
];

export const WORKFLOW_SAMPLE_DESCRIPTION = 'Minta adat' as const;

export type WorkflowSampleOrganization = {
  documentId: string;
  name?: string | null;
};

export type BuildWorkflowSamplePreviewResult =
  | { ok: true; previewInput: ConvertPreviewRequest }
  | {
      ok: false;
      reason: 'missing_accounts' | 'missing_currency' | 'missing_organization';
    };

/** Round sample amount from workflow currency metadata (money vs quantity). */
export function sampleAmountForWorkflow(
  workflow: WorkflowTemplateHeader,
): number {
  const code = workflow.currency_type?.code?.trim().toLowerCase() ?? '';
  const name = workflow.currency_type?.name?.trim().toLowerCase() ?? '';
  if (code === 'huf' || code === 'ft' || name.includes('forint')) {
    return 100_000;
  }
  const quantityLike =
    QUANTITY_CURRENCY_HINTS.some(
      (hint) => code.includes(hint) || name.includes(hint),
    ) || /^(qty|db)$/i.test(code);
  return quantityLike ? 100 : 100_000;
}

export function pickAccountForWorkflowPattern(
  accounts: readonly AccountChoice[],
  pattern: string | number,
): AccountChoice | null {
  for (const account of accounts) {
    const code = normalizeAccountCode(account.code);
    if (!code) continue;
    if (accountCodeMatchesPattern(code, pattern)) {
      return account;
    }
  }
  return null;
}

/** Builds a convert-preview request with inline sample data for one workflow template. */
export function buildWorkflowSamplePreviewInput(
  workflow: WorkflowTemplateHeader,
  accounts: readonly AccountChoice[],
  options?: {
    organization?: WorkflowSampleOrganization | null;
    /** Used when `workflow.currency_type` is missing (typically HUF). */
    fallbackCurrencyDocumentId?: string | null;
    sampleDate?: string;
  },
): BuildWorkflowSamplePreviewResult {
  const debit = pickAccountForWorkflowPattern(
    accounts,
    workflow.debit_account_code,
  );
  const credit = pickAccountForWorkflowPattern(
    accounts,
    workflow.credit_account_code,
  );
  if (!debit?.id || !credit?.id) {
    return { ok: false, reason: 'missing_accounts' };
  }

  const currencyDocId =
    workflow.currency_type?.documentId?.trim() ||
    options?.fallbackCurrencyDocumentId?.trim() ||
    '';
  if (!currencyDocId) {
    return { ok: false, reason: 'missing_currency' };
  }

  if (
    workflow.requires_source_organization &&
    !options?.organization?.documentId?.trim()
  ) {
    return { ok: false, reason: 'missing_organization' };
  }

  const transaction: InlinePreviewTransaction = {
    date: options?.sampleDate ?? DEFAULT_SAMPLE_DATE,
    amount: sampleAmountForWorkflow(workflow),
    description: WORKFLOW_SAMPLE_DESCRIPTION,
    debit_account: { documentId: String(debit.id) },
    credit_account: { documentId: String(credit.id) },
    currency_type: { documentId: currencyDocId },
    transaction_type: workflow.transaction_type?.documentId
      ? { documentId: workflow.transaction_type.documentId }
      : null,
    organization:
      workflow.requires_source_organization && options?.organization
        ? { documentId: options.organization.documentId.trim() }
        : null,
  };

  return {
    ok: true,
    previewInput: {
      workflowDocumentId: workflow.documentId,
      transaction,
    },
  };
}
