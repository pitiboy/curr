/**
 * Controller-only transaction delete with receipt (+ upload) cascade.
 *
 * Rules on `converted_to_workflow`:
 * - `original` only once no `expanded` / `storno` child is left (else purge
 *   its expansion first);
 * - `expanded` can be deleted;
 * - `storno` only when no sibling `expanded` row remains; afterwards the
 *   parent `original` is reset to `null` (expandable again);
 * - `null` (not expanded) can be deleted.
 *
 * `purgeExpansion` removes every expanded + storno child of a parent in one
 * database transaction and resets the parent when it is an `original`.
 */
import {
  contentApiActor,
  relationDocumentId,
  type PublishGuardStrapi,
} from '../publish-guard';
import {
  CONVERTED_EXPANDED,
  CONVERTED_ORIGINAL,
  CONVERTED_STORNO,
  TRANSACTION_UID,
} from '../transaction-workflow/convert';

const RECEIPT_UID = 'api::receipt.receipt';

export const CONTROLLER_ROLE = 'controller' as const;

export class TransactionDeleteError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TransactionDeleteError';
    this.status = status;
  }
}

type Row = Record<string, unknown>;

type DbQuery = {
  findOne: (params: Record<string, unknown>) => Promise<Row | null>;
  findMany: (params: Record<string, unknown>) => Promise<Row[]>;
  updateMany: (params: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<unknown>;
};

type DocumentsApi = {
  delete: (params: { documentId: string }) => Promise<unknown>;
};

export type TransactionDeleteStrapi = Pick<
  PublishGuardStrapi,
  'requestContext'
> & {
  documents: (uid: string) => DocumentsApi;
  db: {
    query: (uid: string) => DbQuery;
    /** Strapi `db.transaction`; optional so fakes can skip it. */
    transaction?: <T>(run: () => Promise<T>) => Promise<T>;
  };
  log: { warn: (message: string) => void };
  plugin: (name: string) => {
    service: (name: string) => {
      remove?: (file: { id: number }) => Promise<unknown>;
    };
  };
};

export type TransactionDeleteResult = {
  /** Deleted transaction documentIds in delete order. */
  deleted: string[];
  /** Deleted receipt documentIds. */
  receipts: string[];
  /** Parent `original` reset to `converted_to_workflow: null`, if any. */
  resetOriginal?: string;
};

async function assertController(strapi: TransactionDeleteStrapi) {
  const actor = await contentApiActor(strapi as unknown as PublishGuardStrapi);
  if (!actor) {
    throw new TransactionDeleteError('Forbidden', 403);
  }
  if (actor.roleType !== CONTROLLER_ROLE) {
    throw new TransactionDeleteError(
      'Only the controller role can delete transactions',
      403,
    );
  }
}

function convertedOf(row: Row): string | null {
  const value = row.converted_to_workflow;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

type LoadedTransaction = {
  documentId: string;
  kinds: Set<string | null>;
  parentDocumentId?: string;
};

/** Draft + published rows of one document (db layer sees both). */
async function loadTransaction(
  strapi: TransactionDeleteStrapi,
  documentId: string,
): Promise<LoadedTransaction> {
  const rows = await strapi.db.query(TRANSACTION_UID).findMany({
    where: { documentId },
    populate: { related_transaction: true },
  });
  if (!rows || rows.length === 0) {
    throw new TransactionDeleteError('Transaction not found', 404);
  }
  let parentDocumentId: string | undefined;
  for (const row of rows) {
    parentDocumentId ??= relationDocumentId(row.related_transaction);
  }
  return {
    documentId,
    kinds: new Set(rows.map(convertedOf)),
    parentDocumentId,
  };
}

async function hasExpandedChild(
  strapi: TransactionDeleteStrapi,
  parentDocumentId: string,
): Promise<boolean> {
  const row = await strapi.db.query(TRANSACTION_UID).findOne({
    where: {
      related_transaction: { documentId: parentDocumentId },
      converted_to_workflow: CONVERTED_EXPANDED,
    },
  });
  return row != null;
}

/** Any `expanded` or `storno` child left under the parent. */
async function hasExpansionChild(
  strapi: TransactionDeleteStrapi,
  parentDocumentId: string,
): Promise<boolean> {
  const row = await strapi.db.query(TRANSACTION_UID).findOne({
    where: {
      related_transaction: { documentId: parentDocumentId },
      converted_to_workflow: { $in: [CONVERTED_EXPANDED, CONVERTED_STORNO] },
    },
  });
  return row != null;
}

type ReceiptRef = { documentId: string; fileIds: number[] };

/** All receipts (draft + published rows) linked to the transaction. */
async function loadReceipts(
  strapi: TransactionDeleteStrapi,
  transactionDocumentId: string,
): Promise<ReceiptRef[]> {
  const rows = await strapi.db.query(RECEIPT_UID).findMany({
    where: { transaction: { documentId: transactionDocumentId } },
    populate: { document: true },
  });
  const byId = new Map<string, Set<number>>();
  for (const row of rows ?? []) {
    const documentId = relationDocumentId(row);
    if (!documentId) continue;
    const files = byId.get(documentId) ?? new Set<number>();
    const document = row.document;
    if (document && typeof document === 'object' && 'id' in document) {
      const id = (document as { id?: unknown }).id;
      if (typeof id === 'number') files.add(id);
    }
    byId.set(documentId, files);
  }
  return [...byId].map(([documentId, files]) => ({
    documentId,
    fileIds: [...files],
  }));
}

async function removeUploadFiles(
  strapi: TransactionDeleteStrapi,
  fileIds: number[],
): Promise<void> {
  for (const fileId of new Set(fileIds)) {
    try {
      const upload = strapi.plugin('upload').service('upload');
      if (typeof upload.remove === 'function') {
        await upload.remove({ id: fileId });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      strapi.log.warn(
        `transaction-delete: upload remove failed for id ${fileId}: ${message}`,
      );
    }
  }
}

/** Deletes receipts then the transaction; returns upload ids to remove after commit. */
async function deleteRowWithReceipts(
  strapi: TransactionDeleteStrapi,
  documentId: string,
  result: TransactionDeleteResult,
): Promise<number[]> {
  const receipts = await loadReceipts(strapi, documentId);
  const fileIds: number[] = [];
  for (const receipt of receipts) {
    await strapi.documents(RECEIPT_UID).delete({
      documentId: receipt.documentId,
    });
    result.receipts.push(receipt.documentId);
    fileIds.push(...receipt.fileIds);
  }
  await strapi.documents(TRANSACTION_UID).delete({ documentId });
  result.deleted.push(documentId);
  return fileIds;
}

async function resetOriginal(
  strapi: TransactionDeleteStrapi,
  documentId: string,
): Promise<void> {
  await strapi.db.query(TRANSACTION_UID).updateMany({
    where: { documentId },
    data: { converted_to_workflow: null },
  });
}

async function inTransaction<T>(
  strapi: TransactionDeleteStrapi,
  run: () => Promise<T>,
): Promise<T> {
  if (typeof strapi.db.transaction === 'function') {
    return strapi.db.transaction(() => run());
  }
  return run();
}

function requireDocumentId(documentId: string): string {
  const trimmed = documentId.trim();
  if (!trimmed) {
    throw new TransactionDeleteError('Missing document id', 400);
  }
  return trimmed;
}

/**
 * Deletes one transaction (draft and/or published) with its receipts.
 * Enforces the `converted_to_workflow` rules described above.
 */
export async function deleteTransactionWithReceipts(
  strapi: TransactionDeleteStrapi,
  documentId: string,
): Promise<TransactionDeleteResult> {
  const id = requireDocumentId(documentId);
  await assertController(strapi);
  const tx = await loadTransaction(strapi, id);

  if (
    tx.kinds.has(CONVERTED_ORIGINAL) &&
    (await hasExpansionChild(strapi, id))
  ) {
    throw new TransactionDeleteError(
      'An expanded original transaction cannot be deleted; purge its expansion first',
      403,
    );
  }

  const isStorno = tx.kinds.has(CONVERTED_STORNO);
  if (
    isStorno &&
    tx.parentDocumentId &&
    (await hasExpandedChild(strapi, tx.parentDocumentId))
  ) {
    throw new TransactionDeleteError(
      'The storno row can only be deleted after every expanded row is deleted',
      403,
    );
  }

  const result: TransactionDeleteResult = { deleted: [], receipts: [] };
  const fileIds = await inTransaction(strapi, async () => {
    const files = await deleteRowWithReceipts(strapi, id, result);
    if (isStorno && tx.parentDocumentId) {
      await resetOriginal(strapi, tx.parentDocumentId);
      result.resetOriginal = tx.parentDocumentId;
    }
    return files;
  });
  await removeUploadFiles(strapi, fileIds);
  return result;
}

/**
 * Deletes every `expanded` and `storno` child of a parent transaction
 * (expanded first, storno last, receipts cascaded). When the parent is an
 * `original` it is reset to `converted_to_workflow: null` (expandable again),
 * even if no child remains. Any other parent (e.g. a bulk-entry anchor whose
 * group holds expanded rows) needs at least one such child, else 409.
 */
export async function purgeExpansion(
  strapi: TransactionDeleteStrapi,
  parentDocumentId: string,
): Promise<TransactionDeleteResult> {
  const id = requireDocumentId(parentDocumentId);
  await assertController(strapi);
  const tx = await loadTransaction(strapi, id);
  const isOriginal = tx.kinds.has(CONVERTED_ORIGINAL);

  const children = await strapi.db.query(TRANSACTION_UID).findMany({
    where: {
      related_transaction: { documentId: id },
      converted_to_workflow: { $in: [CONVERTED_EXPANDED, CONVERTED_STORNO] },
    },
  });
  const expanded: string[] = [];
  const storno: string[] = [];
  for (const row of children ?? []) {
    const childId = relationDocumentId(row);
    if (!childId) continue;
    const bucket = convertedOf(row) === CONVERTED_STORNO ? storno : expanded;
    if (!expanded.includes(childId) && !storno.includes(childId)) {
      bucket.push(childId);
    }
  }
  if (!isOriginal && expanded.length === 0 && storno.length === 0) {
    throw new TransactionDeleteError(
      'Transaction has no expanded rows to purge',
      409,
    );
  }

  const result: TransactionDeleteResult = { deleted: [], receipts: [] };
  const fileIds = await inTransaction(strapi, async () => {
    const files: number[] = [];
    for (const childId of [...expanded, ...storno]) {
      files.push(...(await deleteRowWithReceipts(strapi, childId, result)));
    }
    if (isOriginal) {
      await resetOriginal(strapi, id);
      result.resetOriginal = id;
    }
    return files;
  });
  await removeUploadFiles(strapi, fileIds);
  return result;
}
