import type { ContentHttpClient } from './receiptDraft';
import {
  encodeStrapiQuery,
  type WorkflowTemplateHeader,
} from './transactionList';

type StrapiWorkflowRow = {
  documentId?: string;
  name?: string | null;
  debit_account_code?: number;
  credit_account_code?: number;
  currency_type?: { documentId?: string } | null;
  transaction_type?: { documentId?: string } | null;
};

type WorkflowListResponse = {
  data?: StrapiWorkflowRow[];
  meta?: { pagination?: { pageCount?: number } };
};

const WORKFLOW_PAGE_SIZE = 100;

const workflowListPopulate = {
  currency_type: { fields: ['documentId'] },
  transaction_type: { fields: ['documentId'] },
};

function toWorkflowHeader(row: StrapiWorkflowRow): WorkflowTemplateHeader | null {
  if (!row.documentId) return null;
  if (typeof row.debit_account_code !== 'number') return null;
  if (typeof row.credit_account_code !== 'number') return null;
  return {
    documentId: row.documentId,
    name: row.name,
    debit_account_code: row.debit_account_code,
    credit_account_code: row.credit_account_code,
    currency_type: row.currency_type?.documentId
      ? { documentId: row.currency_type.documentId }
      : null,
    transaction_type: row.transaction_type?.documentId
      ? { documentId: row.transaction_type.documentId }
      : null,
  };
}

export function transactionWorkflowConvertUrl(strapiUrl: string): string {
  return `${strapiUrl}/api/transaction-workflows/convert`;
}

export type ConvertTransactionResult = {
  transactionDocumentId: string;
  workflowDocumentId: string;
  stornoDocumentId?: string;
  createdDocumentIds: string[];
};

type ConvertResponse = {
  data?: ConvertTransactionResult[];
};

/** Loads all published workflow templates (header fields only). */
export async function fetchPublishedWorkflows(
  httpClient: ContentHttpClient,
  strapiUrl: string,
): Promise<WorkflowTemplateHeader[]> {
  const workflows: WorkflowTemplateHeader[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const query = encodeStrapiQuery({
      status: 'published',
      populate: workflowListPopulate,
      pagination: { page, pageSize: WORKFLOW_PAGE_SIZE, withCount: true },
    });
    const { json } = (await httpClient(
      `${strapiUrl}/api/transaction-workflows?${query}`,
    )) as { json: WorkflowListResponse };
    for (const row of json.data ?? []) {
      const header = toWorkflowHeader(row);
      if (header) workflows.push(header);
    }
    pageCount = json.meta?.pagination?.pageCount ?? 1;
    page += 1;
  } while (page <= pageCount && page <= 50);

  return workflows;
}

export async function convertTransaction(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  input: {
    transactionDocumentId: string;
    workflowDocumentId: string;
  },
): Promise<ConvertTransactionResult> {
  const { json } = (await httpClient(
    transactionWorkflowConvertUrl(strapiUrl),
    {
      method: 'POST',
      body: JSON.stringify({
        transactionDocumentId: input.transactionDocumentId,
        workflowDocumentId: input.workflowDocumentId,
      }),
    },
  )) as { json: ConvertResponse };
  const first = json.data?.[0];
  if (!first) {
    throw new Error('Convert response missing data');
  }
  return first;
}
