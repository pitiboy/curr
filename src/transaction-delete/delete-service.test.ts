import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deleteTransactionWithReceipts,
  purgeExpansion,
  TransactionDeleteError,
  type TransactionDeleteStrapi,
} from './delete-service.ts';
import { TRANSACTION_UID } from '../transaction-workflow/convert.ts';

const RECEIPT_UID = 'api::receipt.receipt';

type TxRow = {
  documentId: string;
  converted_to_workflow: string | null;
  parent?: string;
  published?: boolean;
};

type ReceiptRow = { documentId: string; tx: string; fileId?: number };

type Op =
  | { kind: 'delete'; uid: string; documentId: string }
  | { kind: 'reset'; documentId: string }
  | { kind: 'uploadRemove'; fileId: number }
  | { kind: 'commit' };

function relationDocId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const id = (value as { documentId?: unknown }).documentId;
  return typeof id === 'string' ? id : undefined;
}

function buildStrapi(options: {
  roleType?: string;
  transactions: TxRow[];
  receipts?: ReceiptRow[];
  withDbTransaction?: boolean;
}): { strapi: TransactionDeleteStrapi; ops: Op[] } {
  const ops: Op[] = [];
  const roleType = options.roleType ?? 'controller';
  let transactions = [...options.transactions];
  let receipts = [...(options.receipts ?? [])];

  const toRow = (tx: TxRow) => ({
    documentId: tx.documentId,
    converted_to_workflow: tx.converted_to_workflow,
    related_transaction: tx.parent ? { documentId: tx.parent } : null,
  });

  const matches = (tx: TxRow, where: Record<string, unknown>) => {
    if (
      typeof where.documentId === 'string' &&
      tx.documentId !== where.documentId
    ) {
      return false;
    }
    const parent = relationDocId(where.related_transaction);
    if (parent !== undefined && tx.parent !== parent) return false;
    const converted = where.converted_to_workflow;
    if (
      typeof converted === 'string' &&
      tx.converted_to_workflow !== converted
    ) {
      return false;
    }
    if (converted && typeof converted === 'object' && '$in' in converted) {
      const list = (converted as { $in: string[] }).$in;
      if (!list.includes(tx.converted_to_workflow ?? '')) return false;
    }
    return true;
  };

  const transactionDb = {
    findOne: async ({ where }: Record<string, unknown>) => {
      const hit = transactions.find((tx) =>
        matches(tx, where as Record<string, unknown>),
      );
      return hit ? toRow(hit) : null;
    },
    findMany: async ({ where }: Record<string, unknown>) =>
      transactions
        .filter((tx) => matches(tx, where as Record<string, unknown>))
        // Draft + published rows of the same document.
        .flatMap((tx) => (tx.published ? [toRow(tx), toRow(tx)] : [toRow(tx)])),
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      for (const tx of transactions) {
        if (tx.documentId === where.documentId) {
          tx.converted_to_workflow = data.converted_to_workflow as null;
          ops.push({ kind: 'reset', documentId: tx.documentId });
        }
      }
    },
  };

  const receiptDb = {
    findOne: async () => null,
    findMany: async ({ where }: Record<string, unknown>) => {
      const txId = relationDocId(
        (where as { transaction?: unknown }).transaction,
      );
      return (
        receipts
          .filter((r) => r.tx === txId)
          // Draft + published row share the same upload file.
          .flatMap((r) => {
            const row = {
              documentId: r.documentId,
              document: r.fileId != null ? { id: r.fileId } : null,
            };
            return [row, { ...row }];
          })
      );
    },
    updateMany: async () => undefined,
  };

  const userQuery = {
    findOne: async () => ({
      email: `${roleType}@example.com`,
      role: { type: roleType },
    }),
    findMany: async () => [],
    updateMany: async () => undefined,
  };

  const strapi: TransactionDeleteStrapi = {
    requestContext: {
      get: () => ({
        state: {
          auth: { strategy: { name: 'users-permissions' } },
          user: { id: 1 },
        },
      }),
    },
    documents: (uid: string) => ({
      delete: async ({ documentId }: { documentId: string }) => {
        ops.push({ kind: 'delete', uid, documentId });
        if (uid === TRANSACTION_UID) {
          transactions = transactions.filter(
            (tx) => tx.documentId !== documentId,
          );
        } else {
          receipts = receipts.filter((r) => r.documentId !== documentId);
        }
      },
    }),
    db: {
      query: (uid: string) => {
        if (uid === TRANSACTION_UID) return transactionDb;
        if (uid === RECEIPT_UID) return receiptDb;
        if (uid === 'plugin::users-permissions.user') return userQuery;
        throw new Error(`unexpected db uid ${uid}`);
      },
      ...(options.withDbTransaction
        ? {
            transaction: async <T>(run: () => Promise<T>) => {
              const result = await run();
              ops.push({ kind: 'commit' });
              return result;
            },
          }
        : {}),
    },
    plugin: (name: string) => ({
      service: (serviceName: string) => ({
        remove: async ({ id }: { id: number }) => {
          if (name === 'upload' && serviceName === 'upload') {
            ops.push({ kind: 'uploadRemove', fileId: id });
          }
        },
      }),
    }),
    log: { warn: () => {} },
  };

  return { strapi, ops };
}

const expandedFamily: TxRow[] = [
  { documentId: 'orig', converted_to_workflow: 'original', published: true },
  { documentId: 'storno', converted_to_workflow: 'storno', parent: 'orig' },
  { documentId: 'step-1', converted_to_workflow: 'expanded', parent: 'orig' },
  { documentId: 'step-2', converted_to_workflow: 'expanded', parent: 'orig' },
];

function cloneFamily(): TxRow[] {
  return expandedFamily.map((tx) => ({ ...tx }));
}

function rejectsWith(status: number, pattern?: RegExp) {
  return (error: unknown) => {
    assert.ok(error instanceof TransactionDeleteError);
    assert.equal(error.status, status);
    if (pattern) assert.match(error.message, pattern);
    return true;
  };
}

describe('deleteTransactionWithReceipts', () => {
  it('deletes an expanded row with its receipts and upload once', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: cloneFamily(),
      receipts: [{ documentId: 'rcpt-1', tx: 'step-1', fileId: 7 }],
    });

    const result = await deleteTransactionWithReceipts(strapi, 'step-1');

    assert.deepEqual(ops, [
      { kind: 'delete', uid: RECEIPT_UID, documentId: 'rcpt-1' },
      { kind: 'delete', uid: TRANSACTION_UID, documentId: 'step-1' },
      { kind: 'uploadRemove', fileId: 7 },
    ]);
    assert.deepEqual(result.deleted, ['step-1']);
    assert.equal(result.resetOriginal, undefined);
  });

  it('deletes a not-expanded (null) transaction', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: [
        { documentId: 'plain', converted_to_workflow: null, published: true },
      ],
    });

    await deleteTransactionWithReceipts(strapi, 'plain');

    assert.deepEqual(ops, [
      { kind: 'delete', uid: TRANSACTION_UID, documentId: 'plain' },
    ]);
  });

  it('rejects an original with 403', async () => {
    const { strapi, ops } = buildStrapi({ transactions: cloneFamily() });

    await assert.rejects(
      () => deleteTransactionWithReceipts(strapi, 'orig'),
      rejectsWith(403, /original/),
    );
    assert.deepEqual(ops, []);
  });

  it('rejects the storno while expanded rows remain', async () => {
    const { strapi, ops } = buildStrapi({ transactions: cloneFamily() });

    await assert.rejects(
      () => deleteTransactionWithReceipts(strapi, 'storno'),
      rejectsWith(403, /storno/),
    );
    assert.deepEqual(ops, []);
  });

  it('deletes the storno once no expanded row remains and resets the original', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: cloneFamily().filter(
        (tx) => tx.converted_to_workflow !== 'expanded',
      ),
      withDbTransaction: true,
    });

    const result = await deleteTransactionWithReceipts(strapi, 'storno');

    assert.deepEqual(ops, [
      { kind: 'delete', uid: TRANSACTION_UID, documentId: 'storno' },
      { kind: 'reset', documentId: 'orig' },
      { kind: 'commit' },
    ]);
    assert.equal(result.resetOriginal, 'orig');
  });

  it('rejects the editor role', async () => {
    const { strapi } = buildStrapi({
      roleType: 'editor',
      transactions: cloneFamily(),
    });

    await assert.rejects(
      () => deleteTransactionWithReceipts(strapi, 'step-1'),
      rejectsWith(403, /controller/),
    );
  });

  it('returns 404 for a missing transaction', async () => {
    const { strapi } = buildStrapi({ transactions: [] });

    await assert.rejects(
      () => deleteTransactionWithReceipts(strapi, 'missing'),
      rejectsWith(404),
    );
  });
});

describe('purgeExpansion', () => {
  it('deletes expanded rows, then storno, cascades receipts, then resets the original', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: cloneFamily(),
      receipts: [
        { documentId: 'rcpt-step', tx: 'step-2', fileId: 11 },
        { documentId: 'rcpt-orig', tx: 'orig', fileId: 12 },
      ],
      withDbTransaction: true,
    });

    const result = await purgeExpansion(strapi, 'orig');

    assert.deepEqual(ops, [
      { kind: 'delete', uid: TRANSACTION_UID, documentId: 'step-1' },
      { kind: 'delete', uid: RECEIPT_UID, documentId: 'rcpt-step' },
      { kind: 'delete', uid: TRANSACTION_UID, documentId: 'step-2' },
      { kind: 'delete', uid: TRANSACTION_UID, documentId: 'storno' },
      // Draft + published rows of the original are both reset.
      { kind: 'reset', documentId: 'orig' },
      { kind: 'commit' },
      { kind: 'uploadRemove', fileId: 11 },
    ]);
    assert.deepEqual(result.deleted, ['step-1', 'step-2', 'storno']);
    assert.deepEqual(result.receipts, ['rcpt-step']);
    assert.equal(result.resetOriginal, 'orig');
  });

  it('rejects a transaction that is not an original', async () => {
    const { strapi } = buildStrapi({ transactions: cloneFamily() });

    await assert.rejects(
      () => purgeExpansion(strapi, 'step-1'),
      rejectsWith(409),
    );
  });

  it('rejects the dataentry role', async () => {
    const { strapi, ops } = buildStrapi({
      roleType: 'dataentry',
      transactions: cloneFamily(),
    });

    await assert.rejects(
      () => purgeExpansion(strapi, 'orig'),
      rejectsWith(403),
    );
    assert.deepEqual(ops, []);
  });
});
