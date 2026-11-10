/**
 * Editor-like (editor / controller) discard of a draft transaction and its draft receipts.
 * Does not grant generic Content API delete on transactions.
 */
import {
  contentApiActor,
  isEditorLikeRole,
  relationDocumentId,
  type PublishGuardStrapi,
} from '../publish-guard';
import { TRANSACTION_UID } from '../transaction-workflow/convert';

const RECEIPT_UID = 'api::receipt.receipt';
export class DiscardDraftError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DiscardDraftError';
    this.status = status;
  }
}

type DocumentsApi = {
  findOne: (params: Record<string, unknown>) => Promise<unknown | null>;
  findMany: (params?: Record<string, unknown>) => Promise<unknown[]>;
  delete: (params: Record<string, unknown>) => Promise<unknown>;
};

export type DiscardDraftStrapi = Pick<
  PublishGuardStrapi,
  'documents' | 'db' | 'requestContext'
> & {
  log: { warn: (message: string) => void };
  plugin: (name: string) => {
    service: (name: string) => {
      remove?: (file: { id: number }) => Promise<unknown>;
    };
  };
};

function documentsApi(strapi: DiscardDraftStrapi, uid: string): DocumentsApi {
  return strapi.documents(uid) as unknown as DocumentsApi;
}

async function assertEditor(strapi: DiscardDraftStrapi): Promise<void> {
  const actor = await contentApiActor(strapi as PublishGuardStrapi);
  if (!actor) {
    throw new DiscardDraftError('Forbidden', 403);
  }
  if (!isEditorLikeRole(actor.roleType)) {
    throw new DiscardDraftError(
      'Only the editor or controller role can discard draft transactions',
      403,
    );
  }
}

async function assertDraftOnlyTransaction(
  strapi: DiscardDraftStrapi,
  documentId: string,
): Promise<void> {
  const txApi = documentsApi(strapi, TRANSACTION_UID);
  const draft = await txApi.findOne({ documentId, status: 'draft' });
  if (!draft) {
    const published = await txApi.findOne({
      documentId,
      status: 'published',
    });
    if (published) {
      throw new DiscardDraftError(
        'Published transactions cannot be discarded',
        403,
      );
    }
    throw new DiscardDraftError('Transaction not found', 404);
  }

  const publishedChild = await strapi.db.query(TRANSACTION_UID).findOne({
    where: {
      related_transaction: { documentId },
      publishedAt: { $notNull: true },
    },
  });
  if (publishedChild) {
    throw new DiscardDraftError(
      'Cannot discard: a published related transaction exists',
      403,
    );
  }
}

async function loadDraftReceipts(
  strapi: DiscardDraftStrapi,
  transactionDocumentId: string,
): Promise<{ documentId: string; fileId?: number }[]> {
  const rows = await documentsApi(strapi, RECEIPT_UID).findMany({
    status: 'draft',
    filters: {
      transaction: { documentId: { $eq: transactionDocumentId } },
    },
    populate: { document: true },
  });

  const publishedLinked = await documentsApi(strapi, RECEIPT_UID).findOne({
    status: 'published',
    filters: {
      transaction: { documentId: { $eq: transactionDocumentId } },
    },
  });
  if (publishedLinked) {
    throw new DiscardDraftError(
      'Published receipts cannot be discarded with the transaction',
      403,
    );
  }

  return (rows ?? []).map((row) => {
    const documentId = relationDocumentId(row) ?? '';
    const document = (row as { document?: unknown }).document;
    let fileId: number | undefined;
    if (document && typeof document === 'object' && 'id' in document) {
      const id = (document as { id?: unknown }).id;
      if (typeof id === 'number') fileId = id;
    }
    return { documentId, fileId };
  });
}

async function removeUploadFile(
  strapi: DiscardDraftStrapi,
  fileId: number | undefined,
): Promise<void> {
  if (fileId == null) return;
  try {
    const upload = strapi.plugin('upload').service('upload');
    if (typeof upload.remove === 'function') {
      await upload.remove({ id: fileId });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.warn(
      `discard-draft: upload remove failed for id ${fileId}: ${message}`,
    );
  }
}

/**
 * Permanently deletes a draft transaction and its draft receipts (and upload files when possible).
 */
export async function discardDraftTransaction(
  strapi: DiscardDraftStrapi,
  documentId: string,
): Promise<void> {
  const trimmed = documentId.trim();
  if (!trimmed) {
    throw new DiscardDraftError('Missing document id', 400);
  }

  await assertEditor(strapi);
  await assertDraftOnlyTransaction(strapi, trimmed);

  const receipts = await loadDraftReceipts(strapi, trimmed);
  const receiptApi = documentsApi(strapi, RECEIPT_UID);
  for (const receipt of receipts) {
    if (!receipt.documentId) continue;
    await receiptApi.delete({ documentId: receipt.documentId });
    await removeUploadFile(strapi, receipt.fileId);
  }

  await documentsApi(strapi, TRANSACTION_UID).delete({ documentId: trimmed });
}
