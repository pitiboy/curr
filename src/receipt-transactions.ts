/**
 * Receipt ↔ transaction many-to-many helpers (join table + document queries).
 */
import { relationDocumentId } from './publish-guard';

export const RECEIPT_UID = 'api::receipt.receipt';
export const TRANSACTION_UID = 'api::transaction.transaction';

type JoinTableMeta = {
  name: string;
  receiptColumn: string;
  transactionColumn: string;
};

type KnexLike = {
  where: (cond: Record<string, unknown>) => KnexLike;
  count: (arg: Record<string, string>) => KnexLike;
  first: () => Promise<Record<string, unknown> | undefined>;
  delete: () => Promise<void>;
};

export type ReceiptTransactionsStrapi = {
  db: {
    query: (uid: string) => {
      findOne: (
        params: Record<string, unknown>,
      ) => Promise<Record<string, unknown> | null>;
      findMany: (
        params: Record<string, unknown>,
      ) => Promise<Record<string, unknown>[]>;
    };
    metadata?: { get: (uid: string) => unknown };
    connection?: (table: string) => KnexLike;
  };
  documents: (uid: string) => {
    delete: (params: { documentId: string }) => Promise<unknown>;
  };
};

function receiptTransactionsJoinTable(
  strapi: ReceiptTransactionsStrapi,
): JoinTableMeta | null {
  const transactionMeta = strapi.db.metadata?.get(TRANSACTION_UID) as
    { attributes?: Record<string, unknown> } | undefined;
  const attr = transactionMeta?.attributes?.receipts as
    | {
        joinTable?: {
          name?: string;
          joinColumn?: { name?: string };
          inverseJoinColumn?: { name?: string };
        };
      }
    | undefined;
  const joinTable = attr?.joinTable;
  if (
    !joinTable?.name ||
    !joinTable.joinColumn?.name ||
    !joinTable.inverseJoinColumn?.name
  ) {
    return null;
  }
  return {
    name: joinTable.name,
    transactionColumn: joinTable.joinColumn.name,
    receiptColumn: joinTable.inverseJoinColumn.name,
  };
}

export function transactionsFilter(
  documentId: string,
): Record<string, unknown> {
  return { transactions: { documentId: { $eq: documentId } } };
}

export async function loadReceiptRefsForTransaction(
  strapi: ReceiptTransactionsStrapi,
  transactionDocumentId: string,
): Promise<{ documentId: string; fileIds: number[] }[]> {
  const rows = await strapi.db.query(RECEIPT_UID).findMany({
    where: transactionsFilter(transactionDocumentId),
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

async function transactionLinkCount(
  strapi: ReceiptTransactionsStrapi,
  receiptId: number,
): Promise<number> {
  const meta = receiptTransactionsJoinTable(strapi);
  const conn = strapi.db.connection;
  if (!meta || !conn) return 0;
  const row = await conn(meta.name)
    .where({ [meta.receiptColumn]: receiptId })
    .count({ count: '*' })
    .first();
  const count = row?.count;
  if (typeof count === 'number') return count;
  if (typeof count === 'string') return Number(count);
  return 0;
}

async function unlinkReceiptFromTransaction(
  strapi: ReceiptTransactionsStrapi,
  receiptId: number,
  transactionId: number,
): Promise<void> {
  const meta = receiptTransactionsJoinTable(strapi);
  const conn = strapi.db.connection;
  if (!meta || !conn) return;
  await conn(meta.name)
    .where({
      [meta.receiptColumn]: receiptId,
      [meta.transactionColumn]: transactionId,
    })
    .delete();
}

async function numericId(
  strapi: ReceiptTransactionsStrapi,
  uid: string,
  documentId: string,
): Promise<number | null> {
  const row = await strapi.db.query(uid).findOne({
    where: { documentId },
    select: ['id'],
  });
  const id = row?.id;
  return typeof id === 'number' ? id : null;
}

/**
 * Removes each receipt from the transaction. Deletes the receipt document (and
 * caller may remove uploads) only when no other transaction remains linked.
 */
export async function unlinkOrDeleteReceiptsForTransaction(
  strapi: ReceiptTransactionsStrapi,
  transactionDocumentId: string,
  onDeleteReceipt: (receiptDocumentId: string, fileIds: number[]) => void,
): Promise<number[]> {
  const transactionId = await numericId(
    strapi,
    TRANSACTION_UID,
    transactionDocumentId,
  );
  if (transactionId == null) {
    return [];
  }
  const receipts = await loadReceiptRefsForTransaction(
    strapi,
    transactionDocumentId,
  );
  const fileIds: number[] = [];
  for (const receipt of receipts) {
    const receiptId = await numericId(strapi, RECEIPT_UID, receipt.documentId);
    if (receiptId == null) continue;
    await unlinkReceiptFromTransaction(strapi, receiptId, transactionId);
    const remaining = await transactionLinkCount(strapi, receiptId);
    if (remaining === 0) {
      await strapi.documents(RECEIPT_UID).delete({
        documentId: receipt.documentId,
      });
      onDeleteReceipt(receipt.documentId, receipt.fileIds);
      fileIds.push(...receipt.fileIds);
    }
  }
  return fileIds;
}
