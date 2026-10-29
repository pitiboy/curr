/**
 * Convert API Strapi réteg: sablonok és tranzakciók betöltése, expand, majd create/publish/delete.
 * keep_original: storno + step sorok, related_transaction → eredeti; converted_to_workflow jelölés.
 * keep_original false: eredeti törlése, step lánc; receipt csak copy_receipt stepnél.
 */
import {
  MEMBER_UID,
  TRANSACTION_UID,
  WORKFLOW_UID,
  TransactionWorkflowError,
  assertKeepOriginalReceiptPolicy,
  buildSiblingMap,
  expandWorkflowSteps,
  memberAccountFromTransaction,
  pickMatchingWorkflow,
  stornoEnteredKey,
  type ExpandedStepRow,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert';

type DocumentsApi = {
  findMany: (params?: Record<string, unknown>) => Promise<unknown[]>;
  findOne: (params: Record<string, unknown>) => Promise<unknown | null>;
  create: (params: Record<string, unknown>) => Promise<{ documentId: string }>;
  update: (params: Record<string, unknown>) => Promise<unknown>;
  delete: (params: Record<string, unknown>) => Promise<unknown>;
  publish: (params: Record<string, unknown>) => Promise<unknown>;
};

export type ConvertRequest = {
  workflowDocumentId?: string;
  transactionDocumentId?: string;
  steps_published?: boolean;
};

export type ConvertResultItem = {
  transactionDocumentId: string;
  workflowDocumentId: string;
  stornoDocumentId?: string;
  createdDocumentIds: string[];
};

export type ConvertStrapi = {
  documents: (uid: string) => unknown;
  db: {
    query: (uid: string) => {
      findOne: (params: Record<string, unknown>) => Promise<unknown | null>;
    };
  };
  log: { warn: (message: string) => void };
};

function documentsApi(strapi: ConvertStrapi, uid: string): DocumentsApi {
  return strapi.documents(uid) as DocumentsApi;
}

const workflowPopulate = {
  step: {
    populate: {
      debit_account: { fields: ['documentId', 'code'] },
      credit_account: { fields: ['documentId', 'code'] },
      currency_type: { fields: ['documentId'] },
      transaction_type: { fields: ['documentId'] },
      organization: { fields: ['documentId'] },
    },
  },
  currency_type: { fields: ['documentId'] },
  transaction_type: { fields: ['documentId'] },
};

const transactionPopulate = {
  debit_account: { fields: ['documentId', 'code'] },
  credit_account: { fields: ['documentId', 'code'] },
  currency_type: { fields: ['documentId'] },
  transaction_type: { fields: ['documentId'] },
  organization: { fields: ['documentId'] },
  receipts: { fields: ['documentId'] },
};

function asWorkflow(row: unknown): WorkflowTemplate {
  return row as WorkflowTemplate;
}

function asTransaction(row: unknown): SourceTransaction {
  return row as SourceTransaction;
}

async function loadPublishedWorkflows(
  strapi: ConvertStrapi,
  workflowDocumentId?: string,
): Promise<WorkflowTemplate[]> {
  const api = documentsApi(strapi, WORKFLOW_UID);
  if (workflowDocumentId) {
    const row = await api.findOne({
      documentId: workflowDocumentId,
      status: 'published',
      populate: workflowPopulate,
    });
    return row ? [asWorkflow(row)] : [];
  }
  const rows = await api.findMany({
    status: 'published',
    populate: workflowPopulate,
  });
  return (rows ?? []).map(asWorkflow);
}

async function loadTransactions(
  strapi: ConvertStrapi,
  transactionDocumentId?: string,
): Promise<SourceTransaction[]> {
  const api = documentsApi(strapi, TRANSACTION_UID);
  if (transactionDocumentId) {
    const row = await api.findOne({
      documentId: transactionDocumentId,
      populate: transactionPopulate,
    });
    return row ? [asTransaction(row)] : [];
  }
  const rows = await api.findMany({
    filters: { converted_to_workflow: { $eq: false } },
    populate: transactionPopulate,
  });
  return (rows ?? []).map(asTransaction);
}

async function loadMemberSiblingMap(
  strapi: ConvertStrapi,
  transaction: SourceTransaction,
): Promise<Map<string, { documentId: string; code?: string | number | null }>> {
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
      account: { select: ['documentId', 'code'] },
      private_account: { select: ['documentId', 'code'] },
    },
  });

  return buildSiblingMap(memberAccount, member as {
    account?: { documentId: string; code?: string | number | null } | null;
    private_account?: { documentId: string; code?: string | number | null } | null;
  });
}

function transactionWritePayload(
  row: ExpandedStepRow,
  transaction: SourceTransaction,
  relatedDocumentId: string | null,
  published: boolean,
  receiptDocumentIds: string[],
) {
  return {
    date: transaction.date,
    amount: row.amount,
    description: row.description,
    debit_account: row.debit_account.documentId,
    credit_account: row.credit_account.documentId,
    currency_type: row.currency_type.documentId,
    organization: row.organization.documentId,
    transaction_type: row.transaction_type?.documentId ?? undefined,
    related_transaction: relatedDocumentId ?? undefined,
    entered_key: row.entered_key,
    converted_to_workflow: false,
    ...(receiptDocumentIds.length
      ? { receipts: receiptDocumentIds.map((documentId) => ({ documentId })) }
      : {}),
  };
}

async function createTransactionRow(
  strapi: ConvertStrapi,
  data: Record<string, unknown>,
  published: boolean,
): Promise<string> {
  const api = documentsApi(strapi, TRANSACTION_UID);
  const created = await api.create({
    data,
    ...(published ? {} : { status: 'draft' }),
  });
  if (published) {
    await api.publish({ documentId: created.documentId });
  }
  return created.documentId;
}

async function markConverted(
  strapi: ConvertStrapi,
  documentId: string,
): Promise<void> {
  await documentsApi(strapi, TRANSACTION_UID).update({
    documentId,
    data: { converted_to_workflow: true },
  });
}

export async function convertTransactions(
  strapi: ConvertStrapi,
  request: ConvertRequest,
): Promise<ConvertResultItem[]> {
  if (!request.workflowDocumentId && !request.transactionDocumentId) {
    throw new TransactionWorkflowError(
      'Provide workflowDocumentId and/or transactionDocumentId',
      400,
    );
  }

  const workflows = await loadPublishedWorkflows(
    strapi,
    request.workflowDocumentId,
  );
  if (request.workflowDocumentId && workflows.length === 0) {
    throw new TransactionWorkflowError(
      'Published transaction-workflow not found',
      404,
    );
  }

  const transactions = await loadTransactions(
    strapi,
    request.transactionDocumentId,
  );

  const results: ConvertResultItem[] = [];

  for (const transaction of transactions) {
    if (transaction.converted_to_workflow === true) continue;

    const workflow = pickMatchingWorkflow(workflows, transaction);
    if (!workflow) continue;

    const keepOriginal = workflow.keep_original !== false;
    const published =
      request.steps_published ?? workflow.steps_published !== false;
    const siblingMap = await loadMemberSiblingMap(strapi, transaction);
    const expanded = expandWorkflowSteps(workflow, transaction, siblingMap);
    assertKeepOriginalReceiptPolicy(keepOriginal, transaction, expanded);

    const receiptIds =
      transaction.receipts?.map((row) => row.documentId).filter(Boolean) ?? [];

    let stornoDocumentId: string | undefined;
    const createdDocumentIds: string[] = [];

    if (keepOriginal) {
      stornoDocumentId = await createTransactionRow(
        strapi,
        {
          date: transaction.date,
          amount: -Number(transaction.amount),
          description: transaction.description,
          debit_account: transaction.debit_account?.documentId,
          credit_account: transaction.credit_account?.documentId,
          currency_type: transaction.currency_type?.documentId,
          organization: transaction.organization?.documentId,
          transaction_type: transaction.transaction_type?.documentId,
          related_transaction: transaction.documentId,
          entered_key: stornoEnteredKey(transaction.documentId),
          converted_to_workflow: true,
        },
        published,
      );

      for (const row of expanded) {
        const copyReceipts = row.copy_receipt ? receiptIds : [];
        const documentId = await createTransactionRow(
          strapi,
          transactionWritePayload(
            row,
            transaction,
            transaction.documentId,
            published,
            copyReceipts,
          ),
          published,
        );
        createdDocumentIds.push(documentId);
      }

      await markConverted(strapi, transaction.documentId);
      await markConverted(strapi, stornoDocumentId);
    } else {
      let previousRelated: string | null = null;
      for (const row of expanded) {
        const copyReceipts = row.copy_receipt ? receiptIds : [];
        const documentId = await createTransactionRow(
          strapi,
          transactionWritePayload(
            row,
            transaction,
            previousRelated,
            published,
            copyReceipts,
          ),
          published,
        );
        previousRelated = documentId;
        createdDocumentIds.push(documentId);
      }
      await documentsApi(strapi, TRANSACTION_UID).delete({
        documentId: transaction.documentId,
      });
    }

    results.push({
      transactionDocumentId: transaction.documentId,
      workflowDocumentId: workflow.documentId,
      stornoDocumentId,
      createdDocumentIds,
    });
  }

  return results;
}
