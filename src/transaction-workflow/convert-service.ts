/**
 * Convert API Strapi layer: load templates/transactions, expand, then create/publish/delete.
 * keep_original: mark source original, then storno + step rows (related_transaction -> original);
 * converted_to_workflow: original on source, storno on storno, expanded on steps.
 * Generated step rows follow steps_published. Source and storno publish only when
 * they meet the seven publish-required fields (incomplete draft v1 may omit
 * organization / accounts); otherwise they stay draft while steps may still publish.
 * Partial keep_original failure rolls back created rows and clears the source mark.
 * keep_original false: delete original, step chain; receipt only on copy_receipt steps.
 * apply_currency_rate steps: rates and the member ratio resolve before any write
 * (422 CURRENCY_RATE_MISSING / MEMBERSHIP_RATIO_AMBIGUOUS leave no rows).
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
  buildStornoRowShape,
  expandWorkflowSteps,
  isExpandableConvertedValue,
  memberAccountFromTransaction,
  pickMatchingWorkflow,
  type ExpandedStepRow,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert';
import {
  createRateResolver,
  loadMemberRatio,
  resolveWorkflowRates,
} from './convert-context';

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

export type AppliedRateResult = {
  stepIndex: number;
  fromCurrencyDocumentId: string;
  toCurrencyDocumentId: string;
  rate: number;
  validFrom: string | null;
  currencyRateDocumentId: string | null;
  /** Member ratio multiplier (1 when none applied). */
  ratio: number;
  membershipDocumentId: string | null;
};

export type ConvertResultItem = {
  transactionDocumentId: string;
  workflowDocumentId: string;
  stornoDocumentId?: string;
  createdDocumentIds: string[];
  /** Only apply_currency_rate steps. */
  appliedRates: AppliedRateResult[];
};

function appliedRatesOf(rows: ExpandedStepRow[]): AppliedRateResult[] {
  return rows
    .filter((row) => row.appliedRate)
    .map((row) => ({
      stepIndex: row.index,
      ...row.appliedRate!,
      ratio: row.memberRatio?.ratio ?? 1,
      membershipDocumentId: row.memberRatio?.membershipDocumentId ?? null,
    }));
}

export type ConvertStrapi = {
  documents: (uid: string) => unknown;
  db: {
    query: (uid: string) => {
      findOne: (params: Record<string, unknown>) => Promise<unknown | null>;
    };
  };
  requestContext: {
    get: () => { state?: { publishGuardLinked?: boolean } } | undefined;
  };
  log: { warn: (message: string) => void };
};

function documentsApi(strapi: ConvertStrapi, uid: string): DocumentsApi {
  return strapi.documents(uid) as DocumentsApi;
}

/** Nested relations inside a dynamic zone need per-component `on` fragments (Strapi 5). */
const stepSharedPopulate = {
  currency_type: { fields: ['documentId', 'code'] },
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
  currency_type: { fields: ['documentId', 'code'] },
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

  return buildSiblingMap(
    memberAccount,
    member as {
      account?: { documentId: string; code?: string | number | null } | null;
      private_account?: {
        documentId: string;
        code?: string | number | null;
      } | null;
    },
  );
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
    ...(row.organization?.documentId
      ? { organization: row.organization.documentId }
      : {}),
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
    try {
      await withPublishGuardLinked(strapi, () =>
        api.publish({ documentId: created.documentId }),
      );
    } catch (error) {
      // Drop the draft so a failed publish does not strand an entered_key row.
      try {
        await api.delete({ documentId: created.documentId });
      } catch {
        // Best-effort cleanup; rethrow the publish error.
      }
      throw error;
    }
  }
  return created.documentId;
}

/** Best-effort undo after a failed keep_original convert mid-flight. */
async function rollbackKeepOriginalConvert(
  strapi: ConvertStrapi,
  sourceDocumentId: string,
  createdDocumentIds: string[],
): Promise<void> {
  const api = documentsApi(strapi, TRANSACTION_UID);
  for (const documentId of [...createdDocumentIds].reverse()) {
    try {
      await api.delete({ documentId });
    } catch {
      // Best-effort: continue clearing the rest.
    }
  }
  try {
    await api.update({
      documentId: sourceDocumentId,
      data: { converted_to_workflow: null },
      status: 'draft',
    });
  } catch {
    // Best-effort: caller still rethrows the original convert error.
  }
}

function stornoPublishFields(
  stornoShape: ReturnType<typeof buildStornoRowShape>,
): Record<string, unknown> {
  return {
    date: stornoShape.date,
    amount: stornoShape.amount,
    description: stornoShape.description,
    currency_type: stornoShape.currency_type,
    organization: stornoShape.organization,
    debit_account: stornoShape.debit_account,
    credit_account: stornoShape.credit_account,
  };
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
      await withPublishGuardLinked(strapi, () => api.publish({ documentId }));
    }
    return;
  }
  try {
    await withPublishGuardLinked(strapi, () => api.unpublish({ documentId }));
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

  // Prefer the client-supplied documentId; if it is stale (reseed / cache),
  // fall back to all published templates and match by transaction codes.
  let workflows = await loadPublishedWorkflows(
    strapi,
    request.workflowDocumentId,
  );
  if (request.workflowDocumentId && workflows.length === 0) {
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

  const transactions = await loadTransactions(
    strapi,
    request.transactionDocumentId,
  );

  const results: ConvertResultItem[] = [];
  const resolveRate = createRateResolver(strapi);

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
    // Resolve rate + member ratio before any write (no rollback needed on 422).
    const rates = await resolveWorkflowRates(
      resolveRate,
      workflow,
      transaction,
    );
    const memberRatio = await loadMemberRatio(strapi, workflow, transaction);
    const expanded = expandWorkflowSteps(
      workflow,
      transaction,
      siblingMap,
      rates,
      memberRatio,
    );
    assertKeepOriginalReceiptPolicy(keepOriginal, transaction, expanded);

    const receiptIds =
      transaction.receipts?.map((row) => row.documentId).filter(Boolean) ?? [];

    let stornoDocumentId: string | undefined;
    const createdDocumentIds: string[] = [];

    if (keepOriginal) {
      const stornoShape = buildStornoRowShape(transaction);
      // Mirror the source gate: incomplete draft must not force-publish storno
      // (publish-guard 400 would otherwise leave original+storno orphans).
      const publishStorno = shouldPublishConvertedSource(
        stornoPublishFields(stornoShape),
        published,
      );
      const rollbackIds: string[] = [];

      try {
        await syncSourceAfterConvert(strapi, transaction.documentId, published);

        stornoDocumentId = await createTransactionRow(
          strapi,
          {
            date: stornoShape.date,
            amount: stornoShape.amount,
            description: stornoShape.description,
            debit_account: stornoShape.debit_account?.documentId,
            credit_account: stornoShape.credit_account?.documentId,
            currency_type: stornoShape.currency_type.documentId,
            ...(stornoShape.organization?.documentId
              ? { organization: stornoShape.organization.documentId }
              : {}),
            transaction_type: stornoShape.transaction_type?.documentId,
            related_transaction: stornoShape.related_transaction.documentId,
            entered_key: stornoShape.entered_key,
            converted_to_workflow: CONVERTED_STORNO,
          },
          publishStorno,
        );
        rollbackIds.push(stornoDocumentId);

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
          rollbackIds.push(documentId);
          createdDocumentIds.push(documentId);
        }
      } catch (error) {
        await rollbackKeepOriginalConvert(
          strapi,
          transaction.documentId,
          rollbackIds,
        );
        throw error;
      }
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
      appliedRates: appliedRatesOf(expanded),
    });
  }

  return results;
}
