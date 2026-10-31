import type { AccountChoice } from './accountCodes';
import type { ContentHttpClient } from './receiptDraft';
import {
  encodeStrapiQuery,
  type WorkflowMatchSubject,
  type WorkflowTemplate,
} from './transactionList';

const WORKFLOW_PAGE_SIZE = 100;
const WORKFLOW_MAX_PAGES = 50;

/** Header fields the match needs. The `step` dynamic zone is never loaded. */
const workflowQuery = {
  status: 'published',
  fields: ['name', 'debit_account_code', 'credit_account_code'],
  populate: {
    currency_type: { fields: ['documentId'] },
    transaction_type: { fields: ['documentId'] },
  },
} as const;

export function transactionWorkflowsUrl(strapiUrl: string): string {
  return `${strapiUrl}/api/transaction-workflows`;
}

export function transactionWorkflowConvertUrl(strapiUrl: string): string {
  return `${transactionWorkflowsUrl(strapiUrl)}/convert`;
}

type WorkflowListResponse = {
  data?: WorkflowTemplate[];
  meta?: { pagination?: { pageCount?: number } };
};

/** Every published template, paged. */
export async function fetchPublishedWorkflows(
  httpClient: ContentHttpClient,
  strapiUrl: string,
): Promise<WorkflowTemplate[]> {
  const workflows: WorkflowTemplate[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const query = encodeStrapiQuery({
      ...workflowQuery,
      pagination: { page, pageSize: WORKFLOW_PAGE_SIZE, withCount: true },
    });
    const { json } = await httpClient(
      `${transactionWorkflowsUrl(strapiUrl)}?${query}`,
    );
    const body = (json ?? {}) as WorkflowListResponse;
    workflows.push(...(body.data ?? []));
    pageCount = body.meta?.pagination?.pageCount ?? 1;
    page += 1;
  } while (page <= pageCount && page <= WORKFLOW_MAX_PAGES);

  return workflows;
}

export type ConvertTransactionInput = {
  transactionDocumentId: string;
  workflowDocumentId: string;
};

export type ConvertTransactionResult = {
  transactionDocumentId?: string;
  workflowDocumentId?: string;
  stornoDocumentId?: string | null;
  createdDocumentIds?: string[];
};

/**
 * Convert a matched single-line transaction. The body carries the two ids
 * only: the template decides the step status (no `steps_published` override).
 */
export async function convertTransaction(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  input: ConvertTransactionInput,
): Promise<ConvertTransactionResult[]> {
  const { json } = await httpClient(transactionWorkflowConvertUrl(strapiUrl), {
    method: 'POST',
    body: JSON.stringify({
      transactionDocumentId: input.transactionDocumentId,
      workflowDocumentId: input.workflowDocumentId,
    }),
  });
  const data = (json as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as ConvertTransactionResult[]) : [];
}

/**
 * Create-form snapshot for the match. The selects hold documentIds, so the
 * account code comes from the loaded account catalog. The v1 form has no
 * transaction type; a template with a type therefore never matches here.
 */
export function workflowSubjectFromForm(
  values: Record<string, unknown>,
  accounts: readonly AccountChoice[],
): WorkflowMatchSubject {
  const codeOf = (value: unknown) => {
    const id = formId(value);
    return id
      ? (accounts.find((account) => String(account.id) === id)?.code ?? null)
      : null;
  };
  const currency = formId(values.currency_type);
  const type = formId(values.transaction_type);
  return {
    debit_account: { code: codeOf(values.debit_account) },
    credit_account: { code: codeOf(values.credit_account) },
    currency_type: currency ? { documentId: currency } : null,
    transaction_type: type ? { documentId: type } : null,
  };
}

function formId(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}
