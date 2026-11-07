import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { errors } from '@strapi/utils';

import {
  ORG_SCOPED_DOCUMENT_UID_SET,
  loadUserOrgDocumentIds,
  mergeScopedFilter,
  registerOrgScopeMiddleware,
  shouldApplyOrgScope,
} from './org-scope-middleware.ts';
import { type PublishGuardStrapi } from './publish-guard.ts';

const transaction = 'api::transaction.transaction';
const receipt = 'api::receipt.receipt';
const account = 'api::account.account';

type Middleware = (
  context: {
    uid: string;
    action: string;
    params?: Record<string, unknown>;
  },
  next: () => Promise<unknown>,
) => Promise<unknown>;

function createMiddlewareHarness() {
  const stack: Middleware[] = [];
  return {
    use(fn: Middleware) {
      stack.push(fn);
    },
    async run(
      context: {
        uid: string;
        action: string;
        params?: Record<string, unknown>;
      },
      finalNext: () => Promise<unknown>,
    ) {
      let index = 0;
      const next = async (): Promise<unknown> => {
        if (index < stack.length) {
          return stack[index++]!(context, next);
        }
        return finalNext();
      };
      return next();
    },
    stack,
  };
}

function fakeOrgScopeStrapi(options: {
  userId?: number;
  strategy?: string;
  organizations?: Array<{ documentId?: string }>;
  transactionOrgByDocId?: Record<string, string | undefined>;
  receiptRowByDocId?: Record<
    string,
    { transaction?: { organization?: { documentId?: string } } }
  >;
  transactionRowByDocId?: Record<
    string,
    { organization?: { documentId?: string } }
  >;
}): Pick<PublishGuardStrapi, 'documents' | 'db' | 'requestContext'> {
  const harness = createMiddlewareHarness();
  return {
    documents: Object.assign(
      () => ({
        findOne: async () => null,
        findMany: async () => [],
      }),
      { use: harness.use.bind(harness) },
    ) as unknown as PublishGuardStrapi['documents'],
    requestContext: {
      get: () =>
        options.userId == null
          ? undefined
          : {
              state: {
                auth: {
                  strategy: { name: options.strategy ?? 'users-permissions' },
                },
                user: { id: options.userId },
              },
            },
    },
    db: {
      query: (uid: string) => ({
        findOne: async (params: Record<string, unknown>) => {
          if (uid === 'plugin::users-permissions.user') {
            return {
              id: options.userId,
              email: 'u@example.com',
              role: { type: 'dataentry' },
              organizations: options.organizations ?? [],
            };
          }
          if (uid === transaction) {
            const where = params.where as { documentId?: string } | undefined;
            const docId = where?.documentId;
            if (docId && options.transactionRowByDocId?.[docId] !== undefined) {
              return options.transactionRowByDocId[docId];
            }
            if (docId && options.transactionOrgByDocId?.[docId] !== undefined) {
              const oid = options.transactionOrgByDocId[docId];
              return oid
                ? { organization: { documentId: oid } }
                : { organization: null };
            }
            return { organization: { documentId: 'org-default' } };
          }
          if (uid === receipt) {
            const where = params.where as { documentId?: string } | undefined;
            const docId = where?.documentId;
            if (docId && options.receiptRowByDocId?.[docId]) {
              return options.receiptRowByDocId[docId];
            }
            return null;
          }
          return null;
        },
        update: async () => ({}),
      }),
    },
    // attach harness for tests
    __harness: harness,
  } as Pick<PublishGuardStrapi, 'documents' | 'db' | 'requestContext'> & {
    __harness: ReturnType<typeof createMiddlewareHarness>;
  };
}

describe('shouldApplyOrgScope', () => {
  it('applies only for allowlisted UIDs, U&P strategy, and dataentry/editor', () => {
    assert.equal(
      shouldApplyOrgScope({
        uid: transaction,
        action: 'findMany',
        strategyName: 'users-permissions',
        roleType: 'dataentry',
      }),
      true,
    );
    assert.equal(
      shouldApplyOrgScope({
        uid: transaction,
        action: 'findMany',
        strategyName: 'users-permissions',
        roleType: 'editor',
      }),
      true,
    );
    assert.equal(
      shouldApplyOrgScope({
        uid: account,
        action: 'findMany',
        strategyName: 'users-permissions',
        roleType: 'dataentry',
      }),
      false,
    );
    assert.equal(
      shouldApplyOrgScope({
        uid: transaction,
        action: 'findMany',
        strategyName: 'admin',
        roleType: 'dataentry',
      }),
      false,
    );
  });

  it('returns false when role type is not a scoped content role', () => {
    assert.equal(
      shouldApplyOrgScope({
        uid: transaction,
        action: 'findMany',
        strategyName: 'users-permissions',
        roleType: 'authenticated',
      }),
      false,
    );
  });
});

describe('mergeScopedFilter', () => {
  it('adds organization $and for transactions', () => {
    const merged = mergeScopedFilter(transaction, { amount: { $gt: 1 } }, [
      'org-a',
      'org-b',
    ]);
    assert.deepEqual(merged, {
      $and: [
        { amount: { $gt: 1 } },
        { organization: { documentId: { $in: ['org-a', 'org-b'] } } },
      ],
    });
  });

  it('scopes receipts via transaction.organization', () => {
    const merged = mergeScopedFilter(receipt, undefined, ['org-x']);
    assert.deepEqual(merged, {
      transaction: { organization: { documentId: { $in: ['org-x'] } } },
    });
  });
});

describe('loadUserOrgDocumentIds', () => {
  it('collects documentIds from populated organizations', async () => {
    const strapi = fakeOrgScopeStrapi({
      userId: 1,
      organizations: [{ documentId: 'a1' }, { documentId: 'a2' }],
    });
    assert.deepEqual(await loadUserOrgDocumentIds(strapi, 1), ['a1', 'a2']);
  });
});

describe('registerOrgScopeMiddleware', () => {
  it('does not merge filters for unlisted UIDs', async () => {
    const strapi = fakeOrgScopeStrapi({
      userId: 1,
      organizations: [{ documentId: 'org-a' }],
    }) as ReturnType<typeof fakeOrgScopeStrapi> & {
      __harness: ReturnType<typeof createMiddlewareHarness>;
    };
    registerOrgScopeMiddleware(strapi);
    const params: Record<string, unknown> = {
      filters: { code: { $eq: 1000 } },
    };
    await strapi.__harness.run(
      { uid: account, action: 'findMany', params },
      async () => 'ok',
    );
    assert.deepEqual(params.filters, { code: { $eq: 1000 } });
  });

  it('merges org filter for scoped reads (dataentry)', async () => {
    const strapi = fakeOrgScopeStrapi({
      userId: 1,
      organizations: [{ documentId: 'org-a' }],
    }) as ReturnType<typeof fakeOrgScopeStrapi> & {
      __harness: ReturnType<typeof createMiddlewareHarness>;
    };
    registerOrgScopeMiddleware(strapi);
    const params: Record<string, unknown> = {
      filters: { description: { $containsi: 'x' } },
    };
    await strapi.__harness.run(
      { uid: transaction, action: 'findMany', params },
      async () => 'ok',
    );
    assert.deepEqual(params.filters, {
      $and: [
        { description: { $containsi: 'x' } },
        { organization: { documentId: { $in: ['org-a'] } } },
      ],
    });
  });

  it('bypasses when admin JWT (no users-permissions actor)', async () => {
    const strapi = fakeOrgScopeStrapi({
      userId: 1,
      strategy: 'admin',
      organizations: [{ documentId: 'org-a' }],
    }) as ReturnType<typeof fakeOrgScopeStrapi> & {
      __harness: ReturnType<typeof createMiddlewareHarness>;
    };
    registerOrgScopeMiddleware(strapi);
    const params: Record<string, unknown> = { filters: {} };
    await strapi.__harness.run(
      { uid: transaction, action: 'findMany', params },
      async () => 'ok',
    );
    assert.deepEqual(params.filters, {});
  });

  it('rejects create when user has no organizations', async () => {
    const strapi = fakeOrgScopeStrapi({
      userId: 1,
      organizations: [],
    }) as ReturnType<typeof fakeOrgScopeStrapi> & {
      __harness: ReturnType<typeof createMiddlewareHarness>;
    };
    registerOrgScopeMiddleware(strapi);
    await assert.rejects(
      () =>
        strapi.__harness.run(
          {
            uid: transaction,
            action: 'create',
            params: { data: { organization: 'org-x' } },
          },
          async () => 'ok',
        ),
      (e: unknown) => e instanceof errors.ForbiddenError,
    );
  });
});

describe('ORG_SCOPED_DOCUMENT_UID_SET', () => {
  it('lists transaction and receipt', () => {
    assert.equal(ORG_SCOPED_DOCUMENT_UID_SET.has(transaction), true);
    assert.equal(ORG_SCOPED_DOCUMENT_UID_SET.has(receipt), true);
    assert.equal(ORG_SCOPED_DOCUMENT_UID_SET.has(account), false);
  });
});
