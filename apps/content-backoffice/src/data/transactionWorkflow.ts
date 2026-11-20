import type { ContentHttpClient } from './receiptDraft';
import {
  encodeStrapiQuery,
  type WorkflowTemplateHeader,
} from './transactionList';

type StrapiWorkflowStepRow = {
  __component?: string | null;
  organization_from_original?: boolean | null;
};

type StrapiWorkflowRow = {
  documentId?: string;
  name?: string | null;
  debit_account_code?: string | number;
  credit_account_code?: string | number;
  currency_type?: {
    documentId?: string;
    code?: string | null;
    name?: string | null;
  } | null;
  transaction_type?: {
    documentId?: string;
    name?: string | null;
  } | null;
  step?: StrapiWorkflowStepRow[] | null;
  collect_asset?: boolean | null;
};

function normalizeAccountCodePattern(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined || value === '') return null;
  const pattern = String(value).trim();
  return pattern || null;
}

type WorkflowListResponse = {
  data?: StrapiWorkflowRow[];
  meta?: { pagination?: { pageCount?: number } };
};

const WORKFLOW_PAGE_SIZE = 100;

const stepOrgFromOriginalFields = {
  fields: ['organization_from_original'],
} as const;

const workflowListPopulate = {
  currency_type: { fields: ['documentId', 'code', 'name'] },
  transaction_type: { fields: ['documentId', 'name'] },
  step: {
    on: {
      'workflow.step': stepOrgFromOriginalFields,
      'workflow.step-member-debit': stepOrgFromOriginalFields,
      'workflow.step-member-credit': stepOrgFromOriginalFields,
    },
  },
};

/** True when any step copies organization from the source transaction. */
export function workflowRequiresSourceOrganization(
  steps:
    ReadonlyArray<StrapiWorkflowStepRow | null | undefined> | null | undefined,
): boolean {
  return (steps ?? []).some(
    (step) => step?.organization_from_original === true,
  );
}

function toWorkflowHeader(
  row: StrapiWorkflowRow,
): WorkflowTemplateHeader | null {
  if (!row.documentId) return null;
  const debit_account_code = normalizeAccountCodePattern(
    row.debit_account_code,
  );
  const credit_account_code = normalizeAccountCodePattern(
    row.credit_account_code,
  );
  if (!debit_account_code || !credit_account_code) return null;
  return {
    documentId: row.documentId,
    name: row.name,
    debit_account_code,
    credit_account_code,
    currency_type: row.currency_type?.documentId
      ? {
          documentId: row.currency_type.documentId,
          code: row.currency_type.code ?? null,
          name: row.currency_type.name ?? null,
        }
      : null,
    transaction_type: row.transaction_type?.documentId
      ? {
          documentId: row.transaction_type.documentId,
          name: row.transaction_type.name ?? null,
        }
      : null,
    requires_source_organization: workflowRequiresSourceOrganization(row.step),
    collect_asset: row.collect_asset === true,
  };
}

export function transactionWorkflowConvertUrl(strapiUrl: string): string {
  return `${strapiUrl}/api/transaction-workflows/convert`;
}

export type ConvertLegOverrideInput = {
  key: string;
  sourceStepIndex: number | null;
  description: string;
  amount: number;
  percent: number | null;
  debitAccountDocumentId: string;
  creditAccountDocumentId: string;
  currencyTypeDocumentId: string;
  organizationDocumentId?: string | null;
  transactionTypeDocumentId?: string | null;
  copyReceipt: boolean;
  date?: string;
};

export type ConvertOverridesPayload = {
  legs: ConvertLegOverrideInput[];
};

export type ConvertTransactionResult = {
  transactionDocumentId: string;
  workflowDocumentId: string;
  stornoDocumentId?: string;
  createdDocumentIds: string[];
  customised?: boolean;
};

export type ConvertTransactionFailure = {
  transactionDocumentId: string;
  status: number;
  message: string;
  code?: string;
};

type ConvertResponse = {
  data?: ConvertTransactionResult[];
  failures?: ConvertTransactionFailure[];
};

/** Loads all published workflow templates (header + org-from-original flag). */
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
    overrides?: ConvertOverridesPayload;
  },
): Promise<ConvertTransactionResult> {
  const { json } = (await httpClient(transactionWorkflowConvertUrl(strapiUrl), {
    method: 'POST',
    body: JSON.stringify({
      transactionDocumentId: input.transactionDocumentId,
      workflowDocumentId: input.workflowDocumentId,
      ...(input.overrides ? { overrides: input.overrides } : {}),
    }),
  })) as { json: ConvertResponse };
  const first = json.data?.[0];
  if (!first) {
    const failure = json.failures?.[0];
    if (failure?.message) {
      const error = new Error(failure.message) as Error & {
        status?: number;
        body?: { error?: { message?: string; details?: { code?: string } } };
      };
      error.status = failure.status;
      error.body = {
        error: {
          message: failure.message,
          details: failure.code ? { code: failure.code } : undefined,
        },
      };
      throw error;
    }
    throw new Error('Convert response missing data');
  }
  return first;
}
