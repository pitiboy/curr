/**
 * DB-level claim so only one convert wins across concurrent requests / processes.
 * Sets converted_to_workflow to `original` before any step rows are created.
 */
import {
  CONVERTED_ORIGINAL,
  ERROR_TRANSACTION_ALREADY_CONVERTED,
  TRANSACTION_UID,
  TransactionWorkflowError,
  isExpandableConvertedValue,
} from './convert';
import type { ConvertStrapi } from './convert-service';

type UpdateManyResult = { count?: number };

async function runInDbTransaction<T>(
  strapi: ConvertStrapi,
  task: () => Promise<T>,
): Promise<T> {
  // Call through `strapi.db` so `this` stays bound (Database.transaction uses
  // `this.connection`). Detaching the method causes: reading 'connection' of undefined.
  if (typeof strapi.db.transaction === 'function') {
    return strapi.db.transaction(task);
  }
  return task();
}

/**
 * Atomically mark the source as claimed. Throws 409 when already expanded.
 */
export async function claimSourceForConvert(
  strapi: ConvertStrapi,
  documentId: string,
): Promise<void> {
  await runInDbTransaction(strapi, async () => {
    const updated = (await strapi.db.query(TRANSACTION_UID).updateMany({
      where: {
        documentId,
        $or: [
          { converted_to_workflow: { $null: true } },
          { converted_to_workflow: '' },
          { converted_to_workflow: false },
        ],
      },
      data: { converted_to_workflow: CONVERTED_ORIGINAL },
    })) as UpdateManyResult;

    const count = updated?.count ?? 0;
    if (count > 0) return;

    const row = (await strapi.db.query(TRANSACTION_UID).findOne({
      where: { documentId },
      select: ['converted_to_workflow'],
    })) as { converted_to_workflow?: unknown } | null;

    if (row && isExpandableConvertedValue(row.converted_to_workflow as never)) {
      throw new TransactionWorkflowError(
        'Could not claim transaction for convert',
        409,
        ERROR_TRANSACTION_ALREADY_CONVERTED,
      );
    }

    throw new TransactionWorkflowError(
      'A tranzakció már ki van fejtve.',
      409,
      ERROR_TRANSACTION_ALREADY_CONVERTED,
      { documentId },
    );
  });
}
