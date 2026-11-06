/**
 * Strapi Admin bulk document actions (document-manager) run
 * `Promise.all` of `documents().publish|unpublish|delete` inside one shared
 * knex transaction. When any item fails, the outer trx rolls back while
 * sibling writes are still querying → "Transaction query already complete"
 * and an uncaught process crash.
 *
 * Keep the shared transaction (all-or-nothing) but process documentIds
 * one-by-one so a failure cannot race completed-trx queries.
 */

export async function mapDocumentIdsSequentially<T>(
  documentIds: readonly string[],
  mapOne: (documentId: string) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  for (const documentId of documentIds) {
    results.push(await mapOne(documentId));
  }
  return results;
}

export function countFlatEntries(results: ReadonlyArray<unknown>): number {
  return results.flat().filter(Boolean).length;
}

type DocumentManagerLike = {
  publish: (
    documentId: string,
    uid: string,
    opts?: { locale?: unknown; populate?: unknown },
  ) => Promise<unknown>;
  delete: (
    documentId: string,
    uid: string,
    opts?: Record<string, unknown>,
  ) => Promise<unknown>;
  publishMany: (
    uid: string,
    documentIds: string[],
    locale: unknown,
  ) => Promise<number>;
  unpublishMany: (
    documentIds: string[],
    uid: string,
    opts?: Record<string, unknown>,
  ) => Promise<{ count: number }>;
  deleteMany: (
    documentIds: string[],
    uid: string,
    opts?: Record<string, unknown>,
  ) => Promise<{ count: number }>;
};

type StrapiWithDbTransaction = {
  db: {
    transaction: <T>(cb: () => Promise<T>) => Promise<T>;
  };
  documents: (uid: string) => {
    unpublish: (params: Record<string, unknown>) => Promise<{
      entries?: unknown[];
    } | null>;
  };
};

/**
 * Replace stock parallel bulk publish / unpublish / delete on a
 * document-manager instance.
 */
export function patchDocumentManagerBulkActions(
  manager: DocumentManagerLike,
  strapi: StrapiWithDbTransaction,
): DocumentManagerLike {
  manager.publishMany = async (uid, documentIds, locale) => {
    return strapi.db.transaction(async () => {
      const results = await mapDocumentIdsSequentially(
        documentIds,
        (documentId) =>
          manager.publish(documentId, uid, {
            locale,
            populate: {},
          }),
      );
      return countFlatEntries(results);
    });
  };

  manager.unpublishMany = async (documentIds, uid, opts = {}) => {
    const unpublishedEntries = await strapi.db.transaction(async () => {
      return mapDocumentIdsSequentially(documentIds, async (documentId) => {
        const result = await strapi.documents(uid).unpublish({
          ...opts,
          documentId,
          populate: {},
        });
        return result?.entries;
      });
    });
    return { count: countFlatEntries(unpublishedEntries) };
  };

  manager.deleteMany = async (documentIds, uid, opts = {}) => {
    const deletedEntries = await strapi.db.transaction(async () => {
      return mapDocumentIdsSequentially(documentIds, (documentId) =>
        manager.delete(documentId, uid, opts),
      );
    });
    return { count: deletedEntries.length };
  };

  return manager;
}
