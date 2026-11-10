import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  discardDraftTransaction,
  DiscardDraftError,
  type DiscardDraftStrapi,
} from './discard-service.ts';
import { TRANSACTION_UID } from '../transaction-workflow/convert.ts';

const RECEIPT_UID = 'api::receipt.receipt';

type Op =
  | { kind: 'delete'; uid: string; documentId: string }
  | { kind: 'uploadRemove'; fileId: number };

function buildStrapi(options: {
  roleType?: string;
  hasDraft?: boolean;
  hasPublished?: boolean;
  publishedChild?: boolean;
  publishedReceipt?: boolean;
  receipts?: { documentId: string; fileId?: number }[];
}): { strapi: DiscardDraftStrapi; ops: Op[] } {
  const ops: Op[] = [];
  const roleType = options.roleType ?? 'editor';
  const hasDraft = options.hasDraft ?? true;
  const hasPublished = options.hasPublished ?? false;
  const receipts = options.receipts ?? [];

  const requestContext = {
    get: () => ({
      state: {
        auth: { strategy: { name: 'users-permissions' } },
        user: { id: 1 },
      },
    }),
  };

  const userQuery = {
    findOne: async () => ({
      email: 'editor@example.com',
      role: { type: roleType },
    }),
  };

  const transactionDb = {
    findOne: async (params: Record<string, unknown>) => {
      const where = params.where as Record<string, unknown> | undefined;
      if (
        options.publishedChild &&
        where?.related_transaction &&
        where?.publishedAt
      ) {
        return { documentId: 'child-pub' };
      }
      return null;
    },
    findMany: async () => [],
  };

  const transactionDocs = {
    findOne: async ({ status }: { status?: string }) => {
      if (status === 'draft' && hasDraft) return { documentId: 'tx-1' };
      if (status === 'published' && hasPublished) return { documentId: 'tx-1' };
      return null;
    },
    findMany: async () => [],
    delete: async ({ documentId }: { documentId: string }) => {
      ops.push({ kind: 'delete', uid: TRANSACTION_UID, documentId });
    },
  };

  const receiptDocs = {
    findOne: async ({ status }: { status?: string }) => {
      if (status === 'published' && options.publishedReceipt) {
        return { documentId: 'rcpt-pub' };
      }
      return null;
    },
    findMany: async () =>
      receipts.map((r) => ({
        documentId: r.documentId,
        document: r.fileId != null ? { id: r.fileId } : undefined,
      })),
    delete: async ({ documentId }: { documentId: string }) => {
      ops.push({ kind: 'delete', uid: RECEIPT_UID, documentId });
    },
  };

  const byUid = new Map<string, typeof transactionDocs | typeof receiptDocs>([
    [TRANSACTION_UID, transactionDocs],
    [RECEIPT_UID, receiptDocs],
  ]);

  const strapi: DiscardDraftStrapi = {
    requestContext,
    documents: (uid: string) => {
      const api = byUid.get(uid);
      if (!api) throw new Error(`unexpected uid ${uid}`);
      return api;
    },
    db: {
      query: (uid: string) => {
        if (uid === TRANSACTION_UID) return transactionDb;
        if (uid === 'plugin::users-permissions.user') return userQuery;
        throw new Error(`unexpected db uid ${uid}`);
      },
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

describe('discardDraftTransaction', () => {
  it('deletes draft transaction and linked draft receipts', async () => {
    const { strapi, ops } = buildStrapi({
      receipts: [
        { documentId: 'rcpt-1', fileId: 99 },
        { documentId: 'rcpt-2' },
      ],
    });

    await discardDraftTransaction(strapi, 'tx-1');

    assert.deepEqual(
      ops.filter((o) => o.kind === 'delete'),
      [
        { kind: 'delete', uid: RECEIPT_UID, documentId: 'rcpt-1' },
        { kind: 'delete', uid: RECEIPT_UID, documentId: 'rcpt-2' },
        { kind: 'delete', uid: TRANSACTION_UID, documentId: 'tx-1' },
      ],
    );
    assert.deepEqual(
      ops.filter((o) => o.kind === 'uploadRemove'),
      [{ kind: 'uploadRemove', fileId: 99 }],
    );
  });

  it('rejects published transaction', async () => {
    const { strapi } = buildStrapi({
      hasDraft: false,
      hasPublished: true,
    });

    await assert.rejects(
      () => discardDraftTransaction(strapi, 'tx-1'),
      (error: unknown) => {
        assert.ok(error instanceof DiscardDraftError);
        assert.equal(error.status, 403);
        assert.match(error.message, /Published/);
        return true;
      },
    );
  });

  it('rejects dataentry role', async () => {
    const { strapi } = buildStrapi({ roleType: 'dataentry' });

    await assert.rejects(
      () => discardDraftTransaction(strapi, 'tx-1'),
      (error: unknown) => {
        assert.ok(error instanceof DiscardDraftError);
        assert.equal(error.status, 403);
        assert.match(error.message, /editor or controller/);
        return true;
      },
    );
  });

  it('allows controller role', async () => {
    const { strapi, ops } = buildStrapi({
      roleType: 'controller',
      receipts: [{ documentId: 'rcpt-1', fileId: 9 }],
    });

    await discardDraftTransaction(strapi, 'tx-1');

    assert.deepEqual(
      ops.filter((o) => o.kind === 'delete'),
      [
        { kind: 'delete', uid: RECEIPT_UID, documentId: 'rcpt-1' },
        { kind: 'delete', uid: TRANSACTION_UID, documentId: 'tx-1' },
      ],
    );
    assert.deepEqual(
      ops.filter((o) => o.kind === 'uploadRemove'),
      [{ kind: 'uploadRemove', fileId: 9 }],
    );
  });

  it('rejects when a published receipt is linked', async () => {
    const { strapi } = buildStrapi({ publishedReceipt: true });

    await assert.rejects(
      () => discardDraftTransaction(strapi, 'tx-1'),
      (error: unknown) => {
        assert.ok(error instanceof DiscardDraftError);
        assert.equal(error.status, 403);
        assert.match(error.message, /receipt/i);
        return true;
      },
    );
  });

  it('rejects when a published related transaction exists', async () => {
    const { strapi } = buildStrapi({ publishedChild: true });

    await assert.rejects(
      () => discardDraftTransaction(strapi, 'tx-1'),
      (error: unknown) => {
        assert.ok(error instanceof DiscardDraftError);
        assert.equal(error.status, 403);
        assert.match(error.message, /related transaction/i);
        return true;
      },
    );
  });
});
