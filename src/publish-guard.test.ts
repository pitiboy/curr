import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  contentApiActor,
  guardEffect,
  registerPublishGuard,
  relationDocumentId,
  type PublishGuardStrapi,
} from './publish-guard.ts';

const dataentry = { roleType: 'dataentry', email: 'entry@example.com' };
const editor = { roleType: 'editor', email: 'editor@example.com' };
const transaction = 'api::transaction.transaction';
const receipt = 'api::receipt.receipt';

describe('guardEffect', () => {
  it('ignores content types outside transaction and receipt', () => {
    assert.deepEqual(
      guardEffect('api::organization.organization', 'publish', undefined, dataentry),
      { type: 'ignore' },
    );
  });

  it('lets admin and seed through without rewriting audit fields', () => {
    assert.deepEqual(
      guardEffect(transaction, 'publish', undefined, null),
      { type: 'ignore' },
    );
    assert.deepEqual(
      guardEffect(transaction, 'create', 'published', null),
      { type: 'ignore' },
    );
  });

  it('forbids dataentry publish, unpublish, and published writes', () => {
    for (const [action, status] of [
      ['publish', undefined],
      ['unpublish', undefined],
      ['create', 'published'],
      ['update', 'published'],
    ] as const) {
      assert.equal(
        guardEffect(transaction, action, status, dataentry).type,
        'forbid',
      );
      assert.equal(guardEffect(receipt, action, status, dataentry).type, 'forbid');
    }
  });

  it('treats a missing document-service status as draft for dataentry', () => {
    const effect = guardEffect(transaction, 'create', undefined, dataentry);
    assert.equal(effect.type, 'allow');
    if (effect.type !== 'allow') return;
    assert.equal(effect.enteredBy, dataentry.email);
    assert.equal(effect.publishedByOnData, undefined);
    assert.equal(effect.publishLinkedReceipt, false);
  });

  it('overwrites entered_by on create and drops client audit fields', () => {
    const effect = guardEffect(receipt, 'create', 'draft', dataentry);
    assert.equal(effect.type, 'allow');
    if (effect.type !== 'allow') return;
    assert.equal(effect.clearAuditOnData, true);
    assert.equal(effect.enteredBy, dataentry.email);
  });

  it('keeps the stored entered_by on update', () => {
    const effect = guardEffect(transaction, 'update', 'draft', dataentry);
    assert.equal(effect.type, 'allow');
    if (effect.type !== 'allow') return;
    assert.equal(effect.clearAuditOnData, true);
    assert.equal(effect.enteredBy, undefined);
    assert.equal(effect.publishedByOnData, undefined);
  });

  it('sets published_by when an editor publishes through create or update', () => {
    const effect = guardEffect(transaction, 'update', 'published', editor);
    assert.equal(effect.type, 'allow');
    if (effect.type !== 'allow') return;
    assert.equal(effect.publishedByOnData, editor.email);
    assert.equal(effect.enteredBy, undefined);
    assert.equal(effect.publishLinkedReceipt, true);
  });

  it('writes published_by on the draft for the publish action and clears it on unpublish', () => {
    const publish = guardEffect(transaction, 'publish', undefined, editor);
    const unpublish = guardEffect(receipt, 'unpublish', undefined, editor);
    assert.equal(publish.type, 'allow');
    assert.equal(unpublish.type, 'allow');
    if (publish.type !== 'allow' || unpublish.type !== 'allow') return;
    assert.equal(publish.draftPublishedBy, editor.email);
    assert.equal(publish.publishLinkedReceipt, true);
    assert.equal(unpublish.draftPublishedBy, null);
    assert.equal(unpublish.publishLinkedReceipt, false);
  });

  it('does not cascade a receipt publish back onto transactions', () => {
    const effect = guardEffect(receipt, 'publish', undefined, editor);
    assert.equal(effect.type, 'allow');
    if (effect.type !== 'allow') return;
    assert.equal(effect.publishLinkedReceipt, false);
  });
});

describe('relationDocumentId', () => {
  it('reads a populated relation documentId', () => {
    assert.equal(relationDocumentId({ documentId: 'rec_1' }), 'rec_1');
    assert.equal(relationDocumentId(null), undefined);
    assert.equal(relationDocumentId({ id: 3 }), undefined);
  });
});

function fakeStrapi(options: {
  strategy?: string;
  userId?: number;
  user?: Record<string, unknown> | null;
  onUpdate?: (uid: string, data: Record<string, unknown>) => void;
  documentsApi?: PublishGuardStrapi['documents'];
}): PublishGuardStrapi {
  return {
    documents: options.documentsApi ?? ((() => {
      throw new Error('documents() was not expected');
    }) as unknown as PublishGuardStrapi['documents']),
    requestContext: {
      get: () => ({
        state: {
          auth: { strategy: { name: options.strategy ?? 'users-permissions' } },
          user: options.userId == null ? undefined : { id: options.userId },
        },
      }),
    },
    db: {
      query: (uid: string) => ({
        findOne: async () => {
          if (uid === 'plugin::users-permissions.user') {
            return options.user ?? null;
          }
          return { id: 9, documentId: 'doc_1' };
        },
        update: async ({ data }) => {
          options.onUpdate?.(uid, data);
          return {};
        },
      }),
    },
  };
}

describe('contentApiActor', () => {
  it('returns null for admin and for a users-permissions request without a user', async () => {
    const admin = fakeStrapi({ strategy: 'admin', userId: 1, user: { email: 'a@b.c', role: { type: 'editor' } } });
    assert.equal(await contentApiActor(admin), null);

    const anonymous = fakeStrapi({ user: { email: 'a@b.c', role: { type: 'editor' } } });
    assert.equal(await contentApiActor(anonymous), null);
  });

  it('loads the role from the user record, not from a role already on the request', async () => {
    const strapi = fakeStrapi({
      userId: 4,
      user: { email: 'entry@example.com', role: { type: 'dataentry' } },
    });
    assert.deepEqual(await contentApiActor(strapi), dataentry);
  });
});

describe('registerPublishGuard', () => {
  it('rejects a dataentry published create before next, and keeps the client payload', async () => {
    let nextCalled = false;
    const strapi = fakeStrapi({
      userId: 1,
      user: { email: dataentry.email, role: { type: 'dataentry' } },
    });
    let middleware: (
      context: { uid: string; action: string; params?: { status?: string; data?: Record<string, unknown> } },
      next: () => Promise<unknown>,
    ) => Promise<unknown> = async (_context, next) => next();
    strapi.documents.use = (fn) => {
      middleware = fn;
    };

    registerPublishGuard(strapi);
    const params = {
      status: 'published' as const,
      data: { amount: 10, entered_by: 'forged@example.com' },
    };

    await assert.rejects(
      () =>
        middleware({ uid: transaction, action: 'create', params }, async () => {
          nextCalled = true;
          return { documentId: 'doc_1' };
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /editor role/);
        return true;
      },
    );
    assert.equal(nextCalled, false);
    assert.equal(params.data.entered_by, 'forged@example.com');
  });

  it('stores the caller email on a dataentry draft and ignores a forged entered_by', async () => {
    const strapi = fakeStrapi({
      userId: 1,
      user: { email: dataentry.email, role: { type: 'dataentry' } },
    });
    let middleware: (
      context: { uid: string; action: string; params?: { status?: string; data?: Record<string, unknown> } },
      next: () => Promise<unknown>,
    ) => Promise<unknown> = async (_context, next) => next();
    strapi.documents.use = (fn) => {
      middleware = fn;
    };
    registerPublishGuard(strapi);

    const params = {
      status: 'draft' as const,
      data: { amount: 10, entered_by: 'forged@example.com', published_by: 'forged@example.com' },
    };
    const result = await middleware(
      { uid: transaction, action: 'create', params },
      async () => ({ documentId: 'doc_1' }),
    );

    assert.deepEqual(result, { documentId: 'doc_1' });
    assert.equal(params.data.entered_by, dataentry.email);
    assert.equal(params.data.published_by, undefined);
  });

  it('sets published_by on editor publish and publishes the linked receipt', async () => {
    const updates: Array<{ uid: string; data: Record<string, unknown> }> = [];
    const published: string[] = [];
    const documents = Object.assign(
      (uid: string) => ({
        findOne: async () =>
          uid === transaction ? { documentId: 'tx_1', receipt: { documentId: 'rc_1' } } : null,
        publish: async ({ documentId }: { documentId: string }) => {
          published.push(documentId);
          return { documentId };
        },
      }),
      {
        use: (_fn: unknown) => undefined,
      },
    ) as PublishGuardStrapi['documents'];

    const strapi = fakeStrapi({
      userId: 2,
      user: { email: editor.email, role: { type: 'editor' } },
      onUpdate: (uid, data) => updates.push({ uid, data }),
      documentsApi: documents,
    });
    let middleware: (
      context: { uid: string; action: string; params?: { documentId?: string } },
      next: () => Promise<unknown>,
    ) => Promise<unknown> = async (_context, next) => next();
    strapi.documents.use = (fn) => {
      middleware = fn;
    };
    registerPublishGuard(strapi);

    await middleware(
      { uid: transaction, action: 'publish', params: { documentId: 'tx_1' } },
      async () => ({ documentId: 'tx_1' }),
    );

    assert.deepEqual(updates, [
      { uid: transaction, data: { published_by: editor.email } },
    ]);
    assert.deepEqual(published, ['rc_1']);
  });
});
