/**
 * Convert API Strapi layer: load templates/transactions, expand, then create/publish/delete.
 * keep_original: storno + step rows, related_transaction -> original;
 * converted_to_workflow: original on source, storno on storno, expanded on steps.
 * Generated rows follow steps_published. The source is published only when it
 * already meets the seven publish-required fields; draft v1 may omit
 * organization / accounts, same as a plain Save.
 * keep_original false: delete original, step chain; receipt only on copy_receipt steps.
 */
import {
  shouldPublishConvertedSource,
  withPublishGuardLinked,
} from '../publish-guard';
import {
  CONVERTED_EXPANDED,
  CONVERTED_ORIGINAL,
  CONVERTED_STORNO,
  MEMBER_UID,
  TRANSACTION_UID,
  WORKFLOW_UID,
  TransactionWorkflowError,
  assertKeepOriginalReceiptPolicy,
  buildSiblingMap,
  expandWorkflowSteps,
  isExpandableConvertedValue,
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
  unpublish: (params: Record<string, unknown>) => Promise<unknown>;
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
  requestContext: {
    get: () =>
      | { state?: { publishGuardLinked?: boolean } }
      | undefined;
  };
  log: { warn: (message: string) => void };
};

function documentsApi(strapi: ConvertStrapi, uid: string): DocumentsApi {
  return strapi.documents(uid) as DocumentsApi;
}

/** Nested relations inside a dynamic zone need per-component `on` fragments (Strapi 5). */
const stepSharedPopulate = {
  currency_type: { fields: ['documentId'] },
  transaction_type: { fields: ['documentId'] },
  organization: { fields: ['documentId'] },
};

const workflowPopulate = {
  step: {
    on: {
      'workflow.step': {
        populate: {
          ...stepSharedPopulate,
          debit_account: { fields: ['documentId', 'code'] },
          credit_account: { fields: ['documentId', 'code'] },
        },
      },
      'workflow.step-member-debit': {
        populate: {
          ...stepSharedPopulate,
          credit_account: { fields: ['documentId', 'code'] },
        },
      },
      'workflow.step-member-credit': {
        populate: {
          ...stepSharedPopulate,
          debit_account: { fields: ['documentId', 'code'] },
        },
      },
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
    filters: { converted_to_workflow: { $null: true } },
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
    // Step rows often reuse the header debit/credit pair (e.g. Felújítás
    // Aktiválás); mark expanded so they cannot be expanded again.
    converted_to_workflow: CONVERTED_EXPANDED,
    ...(receiptDocumentIds.length
      ? { receipts: receiptDocumentIds.map((documentId) => ({ documentId })) }
      : {}),
  };
}

async function findDraftByEnteredKey(
  strapi: ConvertStrapi,
  enteredKey: unknown,
): Promise<{ documentId: string } | null> {
  if (typeof enteredKey !== 'string' || !enteredKey) return null;
  const rows = await documentsApi(strapi, TRANSACTION_UID).findMany({
    status: 'draft',
    filters: { entered_key: { $eq: enteredKey } },
  });
  const first = rows?.[0] as { documentId?: string } | undefined;
  return first?.documentId ? { documentId: first.documentId } : null;
}

async function createTransactionRow(
  strapi: ConvertStrapi,
  data: Record<string, unknown>,
  published: boolean,
): Promise<string> {
  const api = documentsApi(strapi, TRANSACTION_UID);
  // Always draft first: creating without status can leave an orphan draft when
  // a later publish fails (e.g. missing required relation), and a retry then
  // hits transactions_entered_key_draft_uq. Reuse that orphan on retry.
  let created: { documentId: string };
  try {
    created = await api.create({
      data,
      status: 'draft',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/entered_key|unique constraint/i.test(message)) {
      throw error;
    }
    const existing = await findDraftByEnteredKey(strapi, data.entered_key);
    if (!existing) {
      throw new TransactionWorkflowError(
        `entered_key conflict while creating transaction: ${message}`,
        409,
      );
    }
    await api.update({
      documentId: existing.documentId,
      data,
      status: 'draft',
    });
    created = existing;
  }
  if (published) {
    // Convert generates + publishes as the same editor; SAME_PERSON would 403
    // and leave orphans keyed by entered_key.
    await withPublishGuardLinked(strapi, () =>
      api.publish({ documentId: created.documentId }),
    );
  }
  return created.documentId;
}

async function loadDraftForPublishCheck(
  strapi: ConvertStrapi,
  documentId: string,
): Promise<Record<string, unknown> | null> {
  const row = await strapi.db.query(TRANSACTION_UID).findOne({
    where: { documentId, publishedAt: { $null: true } },
    populate: {
      organization: true,
      debit_account: true,
      credit_account: true,
      currency_type: true,
    },
  });
  return (row as Record<string, unknown> | null) ?? null;
}

/**
 * Marks the source row converted and aligns its publication status with the
 * generated steps when the source is publishable. Strapi update alone only
 * touches the draft version, so a published source would still show Expand
 * until we re-publish (or unpublish).
 */
async function syncSourceAfterConvert(
  strapi: ConvertStrapi,
  documentId: string,
  published: boolean,
): Promise<void> {
  const api = documentsApi(strapi, TRANSACTION_UID);
  await api.update({
    documentId,
    data: { converted_to_workflow: CONVERTED_ORIGINAL },
    status: 'draft',
  });
  if (published) {
    const draft = await loadDraftForPublishCheck(strapi, documentId);
    if (shouldPublishConvertedSource(draft, true)) {
      await withPublishGuardLinked(strapi, () =>
        api.publish({ documentId }),
      );
    }
    return;
  }
  try {
    await withPublishGuardLinked(strapi, () =>
      api.unpublish({ documentId }),
    );
  } catch {
    // Already draft-only — nothing to unpublish.
  }
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
    if (!isExpandableConvertedValue(transaction.converted_to_workflow)) {
      continue;
    }

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
      // Storno mirrors the source; draft v1 rows may omit organization — fall back
      // to the first step org so schema `required` does not block Convert.
      const stornoOrganization =
        transaction.organization?.documentId ??
        expanded[0]?.organization.documentId;
      if (!stornoOrganization) {
        throw new TransactionWorkflowError(
          'Source transaction and workflow steps have no organization',
          422,
        );
      }
      if (!transaction.currency_type?.documentId) {
        throw new TransactionWorkflowError(
          'Source transaction currency_type is required for convert',
          422,
        );
      }

      stornoDocumentId = await createTransactionRow(
        strapi,
        {
          date: transaction.date,
          amount: -Number(transaction.amount),
          description: transaction.description,
          debit_account: transaction.debit_account?.documentId,
          credit_account: transaction.credit_account?.documentId,
          currency_type: transaction.currency_type.documentId,
          organization: stornoOrganization,
          transaction_type: transaction.transaction_type?.documentId,
          related_transaction: transaction.documentId,
          entered_key: stornoEnteredKey(transaction.documentId),
          converted_to_workflow: CONVERTED_STORNO,
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

      await syncSourceAfterConvert(
        strapi,
        transaction.documentId,
        published,
      );
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
