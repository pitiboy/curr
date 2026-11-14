import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  handlePurgeExpansion,
  handleTransactionDelete,
  type DeleteHandlerCtx,
} from './delete-handlers.ts';
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

type ReceiptRow = { documentId: string; txs: string[]; fileId?: number };

type Op =
  | { kind: 'delete'; uid: string; documentId: string }
  | { kind: 'reset'; documentId: string }
  | { kind: 'uploadRemove'; fileId: number }
  | { kind: 'commit' };

function relationDocId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const id = (value as { documentId?: unknown }).documentId;
  if (typeof id === 'string') return id;
  if (id && typeof id === 'object' && '$eq' in id) {
    const eq = (id as { $eq?: unknown }).$eq;
    return typeof eq === 'string' ? eq : undefined;
  }
  return undefined;
}

function transactionDocumentIdFromWhere(
  where: Record<string, unknown>,
): string | undefined {
  const rel = (where as { transactions?: unknown }).transactions;
  return relationDocId(rel);
}

function buildStrapi(options: {
  roleType?: string;
  /** `admin`: admin-panel JWT; `none`: no request context (system call). */
  auth?: 'users-permissions' | 'admin' | 'none';
  transactions: TxRow[];
  receipts?: ReceiptRow[];
  withDbTransaction?: boolean;
  /** `documents(uid).delete` throws for this documentId. */
  failDeleteOf?: string;
  /** Upload service `remove` throws. */
  uploadThrows?: boolean;
  /** Upload service has no `remove` function. */
  uploadWithoutRemove?: boolean;
}): { strapi: TransactionDeleteStrapi; ops: Op[]; warnings: string[] } {
  const ops: Op[] = [];
  const warnings: string[] = [];
  const auth = options.auth ?? 'users-permissions';
  const roleType = options.roleType ?? 'controller';
  let transactions = [...options.transactions];
  let receipts = [...(options.receipts ?? [])];

  const JOIN_TABLE = 'transactions_receipts_lnk';
  const receiptNumericId = new Map<string, number>();
  const txNumericId = new Map<string, number>();
  let autoId = 1;
  for (const t of transactions) {
    txNumericId.set(t.documentId, autoId++);
  }
  for (const r of receipts) {
    receiptNumericId.set(r.documentId, autoId++);
  }
  const links: { receipt_id: number; transaction_id: number }[] = [];
  for (const r of receipts) {
    const rid = receiptNumericId.get(r.documentId);
    if (rid == null) continue;
    for (const txDoc of r.txs) {
      const tid = txNumericId.get(txDoc);
      if (tid != null) links.push({ receipt_id: rid, transaction_id: tid });
    }
  }

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
    findOne: async ({ where, select }: Record<string, unknown>) => {
      const hit = transactions.find((tx) =>
        matches(tx, where as Record<string, unknown>),
      );
      if (!hit) return null;
      const row = toRow(hit);
      if (Array.isArray(select) && select.includes('id')) {
        return { ...row, id: txNumericId.get(hit.documentId) };
      }
      return row;
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

  const linkQuery = (where: Record<string, number>) =>
    links.filter((row) =>
      Object.entries(where).every(
        ([key, value]) => (row as Record<string, number>)[key] === value,
      ),
    );

  const receiptDb = {
    findOne: async ({ where, select }: Record<string, unknown>) => {
      const w = where as { documentId?: string };
      const hit = receipts.find((r) => r.documentId === w.documentId);
      if (!hit) return null;
      const row = {
        documentId: hit.documentId,
        document: hit.fileId != null ? { id: hit.fileId } : null,
      };
      if (Array.isArray(select) && select.includes('id')) {
        return { ...row, id: receiptNumericId.get(hit.documentId) };
      }
      return row;
    },
    findMany: async ({ where }: Record<string, unknown>) => {
      const txId = transactionDocumentIdFromWhere(
        where as Record<string, unknown>,
      );
      return (
        receipts
          .filter((r) => (txId ? r.txs.includes(txId) : false))
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
      get: () =>
        auth === 'none'
          ? undefined
          : {
              state: {
                auth: { strategy: { name: auth } },
                user: { id: 1 },
              },
            },
    },
    documents: (uid: string) => ({
      delete: async ({ documentId }: { documentId: string }) => {
        if (documentId === options.failDeleteOf) {
          throw new Error(`db failure on ${documentId}`);
        }
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
      metadata: {
        get: (uid: string) =>
          uid === TRANSACTION_UID
            ? {
                attributes: {
                  receipts: {
                    joinTable: {
                      name: JOIN_TABLE,
                      joinColumn: { name: 'transaction_id' },
                      inverseJoinColumn: { name: 'receipt_id' },
                    },
                  },
                },
              }
            : undefined,
      },
      connection: (table: string) => {
        let pendingWhere: Record<string, number> = {};
        let counting = false;
        return {
          where(cond: Record<string, number>) {
            pendingWhere = cond;
            return this;
          },
          count() {
            counting = true;
            return this;
          },
          async first() {
            const hits = linkQuery(pendingWhere);
            if (counting) {
              counting = false;
              return { count: String(hits.length) };
            }
            return hits[0] ?? undefined;
          },
          async delete() {
            for (let i = links.length - 1; i >= 0; i -= 1) {
              const row = links[i]!;
              const match = Object.entries(pendingWhere).every(
                ([key, value]) =>
                  (row as Record<string, number>)[key] === value,
              );
              if (match) links.splice(i, 1);
            }
            void table;
          },
          async insert(row: { receipt_id: number; transaction_id: number }) {
            links.push(row);
          },
        };
      },
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
      service: (serviceName: string) =>
        options.uploadWithoutRemove
          ? {}
          : {
              remove: async ({ id }: { id: number }) => {
                if (options.uploadThrows) {
                  throw new Error('disk full');
                }
                if (name === 'upload' && serviceName === 'upload') {
                  ops.push({ kind: 'uploadRemove', fileId: id });
                }
              },
            },
    }),
    log: { warn: (message: string) => warnings.push(message) },
  };

  return { strapi, ops, warnings };
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
      receipts: [{ documentId: 'rcpt-1', txs: ['step-1'], fileId: 7 }],
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

  it('unlinks a shared receipt from one transaction without deleting it', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: [
        { documentId: 'tx-a', converted_to_workflow: null },
        { documentId: 'tx-b', converted_to_workflow: null },
      ],
      receipts: [
        { documentId: 'shared-rcpt', txs: ['tx-a', 'tx-b'], fileId: 3 },
      ],
    });

    const result = await deleteTransactionWithReceipts(strapi, 'tx-a');

    assert.deepEqual(result.deleted, ['tx-a']);
    assert.deepEqual(result.receipts, []);
    assert.ok(
      !ops.some(
        (op) =>
          op.kind === 'delete' &&
          op.uid === RECEIPT_UID &&
          op.documentId === 'shared-rcpt',
      ),
    );
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

  it('deletes an original without expanded or storno children', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: [{ documentId: 'orig', converted_to_workflow: 'original' }],
    });
    const result = await deleteTransactionWithReceipts(strapi, 'orig');
    assert.deepEqual(result.deleted, ['orig']);
    assert.deepEqual(ops, [
      { kind: 'delete', uid: TRANSACTION_UID, documentId: 'orig' },
    ]);
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
        { documentId: 'rcpt-step', txs: ['step-2'], fileId: 11 },
        { documentId: 'rcpt-orig', txs: ['orig'], fileId: 12 },
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

  it('rejects a non-original parent without expanded children', async () => {
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

describe('deleteTransactionWithReceipts — edge cases', () => {
  for (const auth of ['admin', 'none'] as const) {
    it(`rejects without a Content API actor (${auth}) before touching data`, async () => {
      const { strapi, ops } = buildStrapi({
        auth,
        transactions: cloneFamily(),
      });
      await assert.rejects(
        () => deleteTransactionWithReceipts(strapi, 'step-1'),
        rejectsWith(403, /^Forbidden$/),
      );
      assert.deepEqual(ops, []);
    });
  }

  it('rejects the dataentry role', async () => {
    const { strapi, ops } = buildStrapi({
      roleType: 'dataentry',
      transactions: cloneFamily(),
    });
    await assert.rejects(
      () => deleteTransactionWithReceipts(strapi, 'step-1'),
      rejectsWith(403, /controller/),
    );
    assert.deepEqual(ops, []);
  });

  for (const blank of ['', '   ']) {
    it(`returns 400 for a blank document id (${JSON.stringify(blank)})`, async () => {
      const { strapi, ops } = buildStrapi({ transactions: cloneFamily() });
      await assert.rejects(
        () => deleteTransactionWithReceipts(strapi, blank),
        rejectsWith(400),
      );
      assert.deepEqual(ops, []);
    });
  }

  it('trims the document id', async () => {
    const { strapi, ops } = buildStrapi({ transactions: cloneFamily() });
    const result = await deleteTransactionWithReceipts(strapi, '  step-2 ');
    assert.deepEqual(result.deleted, ['step-2']);
    assert.deepEqual(ops, [
      { kind: 'delete', uid: TRANSACTION_UID, documentId: 'step-2' },
    ]);
  });

  it('deletes a storno without parent link and resets nothing', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: [{ documentId: 'lonely', converted_to_workflow: 'storno' }],
    });
    const result = await deleteTransactionWithReceipts(strapi, 'lonely');
    assert.equal(result.resetOriginal, undefined);
    assert.deepEqual(ops, [
      { kind: 'delete', uid: TRANSACTION_UID, documentId: 'lonely' },
    ]);
  });

  it('a storno of a different original is not blocked by foreign expanded rows', async () => {
    const { strapi } = buildStrapi({
      transactions: [
        ...cloneFamily(),
        { documentId: 'orig-2', converted_to_workflow: 'original' },
        {
          documentId: 'storno-2',
          converted_to_workflow: 'storno',
          parent: 'orig-2',
        },
      ],
    });
    const result = await deleteTransactionWithReceipts(strapi, 'storno-2');
    assert.equal(result.resetOriginal, 'orig-2');
  });

  it('removes an upload shared by several receipts only once', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: cloneFamily(),
      receipts: [
        { documentId: 'r1', txs: ['step-1'], fileId: 5 },
        { documentId: 'r2', txs: ['step-1'], fileId: 5 },
        { documentId: 'r3', txs: ['step-1'] },
      ],
    });
    const result = await deleteTransactionWithReceipts(strapi, 'step-1');
    assert.deepEqual(result.receipts, ['r1', 'r2', 'r3']);
    assert.deepEqual(
      ops.filter((op) => op.kind === 'uploadRemove'),
      [{ kind: 'uploadRemove', fileId: 5 }],
    );
  });

  it('upload removal failure is logged and does not fail the delete', async () => {
    const { strapi, ops, warnings } = buildStrapi({
      transactions: cloneFamily(),
      receipts: [{ documentId: 'r1', txs: ['step-1'], fileId: 9 }],
      uploadThrows: true,
    });
    const result = await deleteTransactionWithReceipts(strapi, 'step-1');
    assert.deepEqual(result.deleted, ['step-1']);
    assert.equal(ops.length, 2);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /id 9: disk full/);
  });

  it('skips upload removal when the upload service has no remove()', async () => {
    const { strapi, warnings } = buildStrapi({
      transactions: cloneFamily(),
      receipts: [{ documentId: 'r1', txs: ['step-1'], fileId: 9 }],
      uploadWithoutRemove: true,
    });
    await deleteTransactionWithReceipts(strapi, 'step-1');
    assert.deepEqual(warnings, []);
  });

  it('db failure while deleting propagates and skips upload removal', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: cloneFamily(),
      receipts: [{ documentId: 'r1', txs: ['step-1'], fileId: 9 }],
      failDeleteOf: 'step-1',
      withDbTransaction: true,
    });
    await assert.rejects(
      () => deleteTransactionWithReceipts(strapi, 'step-1'),
      /db failure on step-1/,
    );
    assert.equal(
      ops.some((op) => op.kind === 'uploadRemove' || op.kind === 'commit'),
      false,
    );
  });
});

describe('purgeExpansion — edge cases', () => {
  it('rejects the editor role', async () => {
    const { strapi, ops } = buildStrapi({
      roleType: 'editor',
      transactions: cloneFamily(),
    });
    await assert.rejects(
      () => purgeExpansion(strapi, 'orig'),
      rejectsWith(403),
    );
    assert.deepEqual(ops, []);
  });

  it('rejects without a Content API actor', async () => {
    const { strapi, ops } = buildStrapi({
      auth: 'none',
      transactions: cloneFamily(),
    });
    await assert.rejects(
      () => purgeExpansion(strapi, 'orig'),
      rejectsWith(403),
    );
    assert.deepEqual(ops, []);
  });

  it('returns 400 for a blank id and 404 for a missing original', async () => {
    const { strapi } = buildStrapi({ transactions: cloneFamily() });
    await assert.rejects(() => purgeExpansion(strapi, ' '), rejectsWith(400));
    await assert.rejects(
      () => purgeExpansion(strapi, 'nope'),
      rejectsWith(404),
    );
  });

  it('rejects a not-expanded (null) transaction with 409', async () => {
    const { strapi } = buildStrapi({
      transactions: [{ documentId: 'plain', converted_to_workflow: null }],
    });
    await assert.rejects(
      () => purgeExpansion(strapi, 'plain'),
      rejectsWith(409, /no expanded rows/),
    );
  });

  it('deletes expanded children of a non-original anchor without reset', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: [
        { documentId: 'anchor', converted_to_workflow: null },
        { documentId: 'leg-1', converted_to_workflow: null, parent: 'anchor' },
        {
          documentId: 'leg-2',
          converted_to_workflow: 'expanded',
          parent: 'anchor',
        },
        {
          documentId: 'leg-3',
          converted_to_workflow: 'expanded',
          parent: 'anchor',
        },
      ],
      receipts: [{ documentId: 'rcpt-3', txs: ['leg-3'], fileId: 21 }],
      withDbTransaction: true,
    });
    const result = await purgeExpansion(strapi, 'anchor');
    assert.deepEqual(result, {
      deleted: ['leg-2', 'leg-3'],
      receipts: ['rcpt-3'],
    });
    assert.deepEqual(ops, [
      { kind: 'delete', uid: TRANSACTION_UID, documentId: 'leg-2' },
      { kind: 'delete', uid: RECEIPT_UID, documentId: 'rcpt-3' },
      { kind: 'delete', uid: TRANSACTION_UID, documentId: 'leg-3' },
      { kind: 'commit' },
      { kind: 'uploadRemove', fileId: 21 },
    ]);
  });

  it('an original without remaining children is only reset', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: [{ documentId: 'orig', converted_to_workflow: 'original' }],
      withDbTransaction: true,
    });
    const result = await purgeExpansion(strapi, 'orig');
    assert.deepEqual(result, {
      deleted: [],
      receipts: [],
      resetOriginal: 'orig',
    });
    assert.deepEqual(ops, [
      { kind: 'reset', documentId: 'orig' },
      { kind: 'commit' },
    ]);
  });

  it('deletes each published child once (draft + published rows)', async () => {
    const { strapi } = buildStrapi({
      transactions: cloneFamily().map((tx) => ({ ...tx, published: true })),
    });
    const result = await purgeExpansion(strapi, 'orig');
    assert.deepEqual(result.deleted, ['step-1', 'step-2', 'storno']);
  });

  it('leaves other originals and unrelated rows untouched', async () => {
    const { strapi } = buildStrapi({
      transactions: [
        ...cloneFamily(),
        { documentId: 'orig-2', converted_to_workflow: 'original' },
        {
          documentId: 'other',
          converted_to_workflow: 'expanded',
          parent: 'orig-2',
        },
        { documentId: 'plain', converted_to_workflow: null },
      ],
    });
    const result = await purgeExpansion(strapi, 'orig');
    assert.deepEqual(result.deleted, ['step-1', 'step-2', 'storno']);
  });

  it('failure mid-purge propagates: no reset, no upload removal', async () => {
    const { strapi, ops } = buildStrapi({
      transactions: cloneFamily(),
      receipts: [{ documentId: 'r1', txs: ['step-1'], fileId: 3 }],
      failDeleteOf: 'step-2',
      withDbTransaction: true,
    });
    await assert.rejects(() => purgeExpansion(strapi, 'orig'), /step-2/);
    assert.equal(
      ops.some(
        (op) =>
          op.kind === 'reset' ||
          op.kind === 'commit' ||
          op.kind === 'uploadRemove',
      ),
      false,
    );
  });
});

describe('HTTP handlers', () => {
  function upCtx(
    id: unknown,
    strategy = 'users-permissions',
  ): DeleteHandlerCtx {
    return {
      params: { id },
      state: { auth: { strategy: { name: strategy } } },
    };
  }

  it('DELETE with an API token falls back to the core delete', async () => {
    const { strapi, ops } = buildStrapi({ transactions: cloneFamily() });
    let coreCalls = 0;
    const ctx = upCtx('orig', 'api-token');
    const out = await handleTransactionDelete(strapi, ctx, async () => {
      coreCalls += 1;
      return 'core';
    });
    assert.equal(out, 'core');
    assert.equal(coreCalls, 1);
    assert.deepEqual(ops, [], 'guarded service not used');
  });

  it('DELETE as controller answers 204 without body', async () => {
    const { strapi } = buildStrapi({ transactions: cloneFamily() });
    const ctx = upCtx(' step-1 ');
    await handleTransactionDelete(strapi, ctx, async () => {
      throw new Error('core delete must not run');
    });
    assert.equal(ctx.status, 204);
    assert.equal(ctx.body, undefined);
  });

  for (const [label, id, status, roleType] of [
    ['original', 'orig', 403, 'controller'],
    ['missing', 'nope', 404, 'controller'],
    ['blank id', '  ', 400, 'controller'],
    ['non-string id', 42, 400, 'controller'],
    ['editor role', 'step-1', 403, 'editor'],
  ] as const) {
    it(`DELETE maps service error to JSON (${label} → ${status})`, async () => {
      const { strapi } = buildStrapi({
        roleType,
        transactions: cloneFamily(),
      });
      const ctx = upCtx(id);
      await handleTransactionDelete(strapi, ctx, async () => undefined);
      assert.equal(ctx.status, status);
      const body = ctx.body as {
        data: unknown;
        error: { status: number; name: string; message: string };
      };
      assert.equal(body.data, null);
      assert.equal(body.error.status, status);
      assert.equal(body.error.name, 'TransactionDeleteError');
      assert.ok(body.error.message.length > 0);
    });
  }

  it('DELETE rethrows unexpected errors (Strapi 500)', async () => {
    const { strapi } = buildStrapi({
      transactions: cloneFamily(),
      failDeleteOf: 'step-1',
    });
    const ctx = upCtx('step-1');
    await assert.rejects(
      () => handleTransactionDelete(strapi, ctx, async () => undefined),
      /db failure/,
    );
    assert.equal(ctx.status, undefined);
  });

  it('purge-expansion returns the result body', async () => {
    const { strapi } = buildStrapi({
      transactions: cloneFamily(),
      receipts: [{ documentId: 'r1', txs: ['step-1'] }],
    });
    const ctx = upCtx('orig');
    await handlePurgeExpansion(strapi, ctx);
    assert.deepEqual(ctx.body, {
      data: {
        documentId: 'orig',
        deleted: ['step-1', 'step-2', 'storno'],
        receipts: ['r1'],
        resetOriginal: 'orig',
      },
    });
  });

  it('purge-expansion maps 409 for a parent without expanded children', async () => {
    const { strapi } = buildStrapi({ transactions: cloneFamily() });
    const ctx = upCtx('step-1');
    await handlePurgeExpansion(strapi, ctx);
    assert.equal(ctx.status, 409);
  });

  it('purge-expansion rethrows unexpected errors', async () => {
    const { strapi } = buildStrapi({
      transactions: cloneFamily(),
      failDeleteOf: 'storno',
    });
    await assert.rejects(
      () => handlePurgeExpansion(strapi, upCtx('orig')),
      /db failure on storno/,
    );
  });
});
