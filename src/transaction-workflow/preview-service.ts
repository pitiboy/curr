/**
 * Convert preview Strapi layer: load data, no writes.
 */
import {
  MEMBER_UID,
  TRANSACTION_UID,
  WORKFLOW_UID,
  TransactionWorkflowError,
  buildSiblingMap,
  isExpandableConvertedValue,
  memberAccountFromTransaction,
  type AccountRef,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert';
import {
  PREVIEW_INLINE_DOCUMENT_ID,
  previewForTransaction,
  type ConvertPreview,
} from './preview';

type DocumentsApi = {
  findMany: (params?: Record<string, unknown>) => Promise<unknown[]>;
  findOne: (params: Record<string, unknown>) => Promise<unknown | null>;
};

export type PreviewStrapi = {
  documents: (uid: string) => unknown;
  db: {
    query: (uid: string) => {
      findOne: (params: Record<string, unknown>) => Promise<unknown | null>;
    };
  };
  log: { warn: (message: string) => void };
};

export type InlinePreviewTransaction = {
  date: string;
  amount: number;
  description?: string | null;
  debit_account: { documentId: string };
  credit_account: { documentId: string };
  currency_type: { documentId: string };
  transaction_type?: { documentId: string } | null;
  organization?: { documentId: string } | null;
  receiptCount?: number;
};

export type ConvertPreviewRequest = {
  workflowDocumentId?: string;
  transactionDocumentId?: string;
  transaction?: InlinePreviewTransaction;
};

const accountFields = ['documentId', 'code', 'name'] as const;
const currencyFields = ['documentId', 'code', 'name'] as const;

const stepSharedPopulate = {
  currency_type: { fields: [...currencyFields] },
  transaction_type: { fields: ['documentId'] },
  organization: { fields: ['documentId'] },
};

const previewWorkflowPopulate = {
  step: {
    on: {
      'workflow.step': {
        populate: {
          ...stepSharedPopulate,
          debit_account: { fields: [...accountFields] },
          credit_account: { fields: [...accountFields] },
        },
      },
      'workflow.step-member-debit': {
        populate: {
          ...stepSharedPopulate,
          credit_account: { fields: [...accountFields] },
        },
      },
      'workflow.step-member-credit': {
        populate: {
          ...stepSharedPopulate,
          debit_account: { fields: [...accountFields] },
        },
      },
    },
  },
  currency_type: { fields: ['documentId'] },
  transaction_type: { fields: ['documentId'] },
};

const transactionPopulate = {
  debit_account: { fields: [...accountFields] },
  credit_account: { fields: [...accountFields] },
  currency_type: { fields: [...currencyFields] },
  transaction_type: { fields: ['documentId'] },
  organization: { fields: ['documentId'] },
  receipts: { fields: ['documentId'] },
};

function documentsApi(strapi: PreviewStrapi, uid: string): DocumentsApi {
  return strapi.documents(uid) as DocumentsApi;
}

function asWorkflow(row: unknown): WorkflowTemplate {
  return row as WorkflowTemplate;
}

function asTransaction(row: unknown): SourceTransaction {
  return row as SourceTransaction;
}

type AccountRow = {
  documentId?: string;
  code?: string | number | null;
  name?: string | null;
};

type CurrencyRow = {
  documentId?: string;
  code?: string | null;
  name?: string | null;
};

function ingestAccount(
  map: Map<string, { code: string; name: string | null }>,
  row: AccountRow | null | undefined,
): void {
  if (!row?.documentId) return;
  const code =
    row.code != null && String(row.code).trim()
      ? String(row.code)
      : (map.get(row.documentId)?.code ?? '');
  if (!code) return;
  map.set(row.documentId, {
    code,
    name: row.name ?? null,
  });
}

function ingestCurrency(
  map: Map<string, { code: string | null; name: string | null }>,
  row: CurrencyRow | null | undefined,
): void {
  if (!row?.documentId) return;
  map.set(row.documentId, {
    code: row.code ?? null,
    name: row.name ?? null,
  });
}

function collectMetaFromWorkflow(
  workflow: WorkflowTemplate,
  accounts: Map<string, { code: string; name: string | null }>,
  currencies: Map<string, { code: string | null; name: string | null }>,
): void {
  for (const step of workflow.step ?? []) {
    ingestAccount(accounts, step.debit_account as AccountRow);
    ingestAccount(accounts, step.credit_account as AccountRow);
    ingestCurrency(currencies, step.currency_type as CurrencyRow);
  }
}

function collectMetaFromTransaction(
  transaction: SourceTransaction,
  accounts: Map<string, { code: string; name: string | null }>,
  currencies: Map<string, { code: string | null; name: string | null }>,
): void {
  ingestAccount(accounts, transaction.debit_account as AccountRow);
  ingestAccount(accounts, transaction.credit_account as AccountRow);
  ingestCurrency(currencies, transaction.currency_type as CurrencyRow);
}

async function loadPublishedWorkflows(
  strapi: PreviewStrapi,
  workflowDocumentId?: string,
): Promise<WorkflowTemplate[]> {
  const api = documentsApi(strapi, WORKFLOW_UID);
  if (workflowDocumentId) {
    const row = await api.findOne({
      documentId: workflowDocumentId,
      status: 'published',
      populate: previewWorkflowPopulate,
    });
    return row ? [asWorkflow(row)] : [];
  }
  const rows = await api.findMany({
    status: 'published',
    populate: previewWorkflowPopulate,
  });
  return (rows ?? []).map(asWorkflow);
}

async function loadTransactionByDocumentId(
  strapi: PreviewStrapi,
  documentId: string,
): Promise<SourceTransaction | null> {
  const row = await documentsApi(strapi, TRANSACTION_UID).findOne({
    documentId,
    populate: transactionPopulate,
  });
  return row ? asTransaction(row) : null;
}

async function loadAccountRow(
  strapi: PreviewStrapi,
  documentId: string,
): Promise<AccountRow | null> {
  const row = await documentsApi(strapi, 'api::account.account').findOne({
    documentId,
    fields: [...accountFields],
  });
  return (row as AccountRow | null) ?? null;
}

async function loadCurrencyRow(
  strapi: PreviewStrapi,
  documentId: string,
): Promise<CurrencyRow | null> {
  const row = await documentsApi(
    strapi,
    'api::currency-type.currency-type',
  ).findOne({
    documentId,
    fields: [...currencyFields],
  });
  return (row as CurrencyRow | null) ?? null;
}

function assertInlineTransaction(raw: unknown): InlinePreviewTransaction {
  if (!raw || typeof raw !== 'object') {
    throw new TransactionWorkflowError(
      'Inline transaction payload is required',
      400,
    );
  }
  const body = raw as Record<string, unknown>;
  const date = body.date;
  const amount = body.amount;
  if (typeof date !== 'string' || !date.trim()) {
    throw new TransactionWorkflowError(
      'Inline transaction date is required',
      422,
    );
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new TransactionWorkflowError(
      'Inline transaction amount must be numeric',
      422,
    );
  }
  const debit = body.debit_account;
  const credit = body.credit_account;
  const currency = body.currency_type;
  if (
    !debit ||
    typeof debit !== 'object' ||
    typeof (debit as { documentId?: unknown }).documentId !== 'string'
  ) {
    throw new TransactionWorkflowError(
      'Inline transaction debit_account.documentId is required',
      422,
    );
  }
  if (
    !credit ||
    typeof credit !== 'object' ||
    typeof (credit as { documentId?: unknown }).documentId !== 'string'
  ) {
    throw new TransactionWorkflowError(
      'Inline transaction credit_account.documentId is required',
      422,
    );
  }
  if (
    !currency ||
    typeof currency !== 'object' ||
    typeof (currency as { documentId?: unknown }).documentId !== 'string'
  ) {
    throw new TransactionWorkflowError(
      'Inline transaction currency_type.documentId is required',
      422,
    );
  }
  const receiptCount = body.receiptCount;
  if (
    receiptCount !== undefined &&
    (typeof receiptCount !== 'number' ||
      !Number.isInteger(receiptCount) ||
      receiptCount < 0)
  ) {
    throw new TransactionWorkflowError(
      'Inline transaction receiptCount must be a non-negative integer',
      422,
    );
  }
  return {
    date: date.trim(),
    amount,
    description: typeof body.description === 'string' ? body.description : null,
    debit_account: {
      documentId: (debit as { documentId: string }).documentId.trim(),
    },
    credit_account: {
      documentId: (credit as { documentId: string }).documentId.trim(),
    },
    currency_type: {
      documentId: (currency as { documentId: string }).documentId.trim(),
    },
    transaction_type:
      body.transaction_type &&
      typeof body.transaction_type === 'object' &&
      typeof (body.transaction_type as { documentId?: unknown }).documentId ===
        'string'
        ? {
            documentId: (
              body.transaction_type as { documentId: string }
            ).documentId.trim(),
          }
        : null,
    organization:
      body.organization &&
      typeof body.organization === 'object' &&
      typeof (body.organization as { documentId?: unknown }).documentId ===
        'string'
        ? {
            documentId: (
              body.organization as { documentId: string }
            ).documentId.trim(),
          }
        : null,
    receiptCount: typeof receiptCount === 'number' ? receiptCount : undefined,
  };
}

async function inlineToSourceTransaction(
  strapi: PreviewStrapi,
  inline: InlinePreviewTransaction,
): Promise<SourceTransaction> {
  const [debitRow, creditRow, currencyRow] = await Promise.all([
    loadAccountRow(strapi, inline.debit_account.documentId),
    loadAccountRow(strapi, inline.credit_account.documentId),
    loadCurrencyRow(strapi, inline.currency_type.documentId),
  ]);
  if (!debitRow?.documentId || debitRow.code == null) {
    throw new TransactionWorkflowError('Debit account not found', 422);
  }
  if (!creditRow?.documentId || creditRow.code == null) {
    throw new TransactionWorkflowError('Credit account not found', 422);
  }
  if (!currencyRow?.documentId) {
    throw new TransactionWorkflowError('Currency type not found', 422);
  }

  const receiptCount = inline.receiptCount ?? 0;
  const receipts =
    receiptCount > 0
      ? Array.from({ length: receiptCount }, (_row, index) => ({
          documentId: `inline-receipt-${index}`,
        }))
      : null;

  return {
    documentId: PREVIEW_INLINE_DOCUMENT_ID,
    date: inline.date,
    amount: inline.amount,
    description: inline.description,
    debit_account: {
      documentId: debitRow.documentId,
      code: debitRow.code,
    },
    credit_account: {
      documentId: creditRow.documentId,
      code: creditRow.code,
    },
    currency_type: {
      documentId: currencyRow.documentId,
    },
    transaction_type: inline.transaction_type,
    organization: inline.organization,
    receipts,
  };
}

async function loadMemberSiblingMap(
  strapi: PreviewStrapi,
  transaction: SourceTransaction,
): Promise<Map<string, AccountRef>> {
  const memberAccount = memberAccountFromTransaction(transaction);
  if (!memberAccount?.documentId) return new Map();

  const member = await strapi.db.query(MEMBER_UID).findOne({
    where: {
      $or: [
        { account: { documentId: memberAccount.documentId } },
        { private_account: { documentId: memberAccount.documentId } },
      ],
    },
    populate: {
      account: { select: ['documentId', 'code', 'name'] },
      private_account: { select: ['documentId', 'code', 'name'] },
    },
  });

  const memberRow = member as {
    account?: AccountRow | null;
    private_account?: AccountRow | null;
  } | null;
  return buildSiblingMap(memberAccount, {
    account:
      memberRow?.account?.documentId != null
        ? {
            documentId: memberRow.account.documentId,
            code: memberRow.account.code,
          }
        : null,
    private_account:
      memberRow?.private_account?.documentId != null
        ? {
            documentId: memberRow.private_account.documentId,
            code: memberRow.private_account.code,
          }
        : null,
  });
}

export async function convertPreview(
  strapi: PreviewStrapi,
  request: ConvertPreviewRequest,
): Promise<ConvertPreview> {
  const hasInline = request.transaction != null;
  const hasSaved = Boolean(request.transactionDocumentId?.trim());
  if (hasInline === hasSaved) {
    throw new TransactionWorkflowError(
      'Provide exactly one of transactionDocumentId or inline transaction',
      400,
    );
  }

  let workflows = await loadPublishedWorkflows(
    strapi,
    request.workflowDocumentId?.trim(),
  );
  if (request.workflowDocumentId?.trim() && workflows.length === 0) {
    strapi.log.warn(
      `Published transaction-workflow ${request.workflowDocumentId} not found; matching by transaction`,
    );
    workflows = await loadPublishedWorkflows(strapi);
  }
  if (workflows.length === 0) {
    throw new TransactionWorkflowError(
      'Published transaction-workflow not found',
      404,
    );
  }

  let transaction: SourceTransaction;
  if (hasSaved) {
    const loaded = await loadTransactionByDocumentId(
      strapi,
      request.transactionDocumentId!.trim(),
    );
    if (!loaded) {
      throw new TransactionWorkflowError('Transaction not found', 404);
    }
    transaction = loaded;
  } else {
    transaction = await inlineToSourceTransaction(
      strapi,
      assertInlineTransaction(request.transaction),
    );
  }

  if (!isExpandableConvertedValue(transaction.converted_to_workflow)) {
    throw new TransactionWorkflowError(
      'Transaction is already converted and cannot be previewed',
      422,
    );
  }

  const siblingMap = await loadMemberSiblingMap(strapi, transaction);
  const accountLookup = new Map<
    string,
    { code: string; name: string | null }
  >();
  const currencyLookup = new Map<
    string,
    { code: string | null; name: string | null }
  >();

  for (const wf of workflows) {
    collectMetaFromWorkflow(wf, accountLookup, currencyLookup);
  }
  collectMetaFromTransaction(transaction, accountLookup, currencyLookup);
  for (const side of [
    transaction.debit_account,
    transaction.credit_account,
  ] as const) {
    const documentId = side?.documentId;
    if (documentId && !accountLookup.has(documentId)) {
      ingestAccount(accountLookup, await loadAccountRow(strapi, documentId));
    }
  }
  const currencyDocumentId = transaction.currency_type?.documentId;
  if (currencyDocumentId && !currencyLookup.has(currencyDocumentId)) {
    ingestCurrency(
      currencyLookup,
      await loadCurrencyRow(strapi, currencyDocumentId),
    );
  }
  for (const ref of siblingMap.values()) {
    ingestAccount(accountLookup, ref as AccountRow);
  }

  return previewForTransaction(
    workflows,
    transaction,
    siblingMap,
    accountLookup,
    currencyLookup,
    request.workflowDocumentId?.trim(),
  );
}
