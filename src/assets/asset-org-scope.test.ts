import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { errors } from '@strapi/utils';

import {
  ORG_SCOPED_DOCUMENT_UID_SET,
  registerOrgScopeMiddleware,
  shouldApplyOrgScope,
} from '../org-scope-middleware.ts';
import type { PublishGuardStrapi } from '../publish-guard.ts';

const ASSET = 'api::asset.asset';
const ASSET_CATEGORY = 'api::asset-category.asset-category';
const TRANSACTION = 'api::transaction.transaction';

type Ctx = { uid: string; action: string; params?: Record<string, unknown> };
type Middleware = (ctx: Ctx, next: () => Promise<unknown>) => Promise<unknown>;

/**
 * Fake Strapi: one user (role + org memberships), asset rows and transaction
 * rows keyed by documentId with their owning organization.
 */
function setup(options: {
  roleType: 'dataentry' | 'editor' | 'controller';
  organizations: string[];
  assetOrg?: Record<string, string>;
  transactionOrg?: Record<string, string>;
}) {
  const stack: Middleware[] = [];
  const orgOf = (map: Record<string, string> | undefined, id?: string) =>
    id && map?.[id] ? { organization: { documentId: map[id] } } : null;
  const strapi = {
    documents: Object.assign(() => ({}), {
      use: (fn: Middleware) => stack.push(fn),
    }) as unknown as PublishGuardStrapi['documents'],
    requestContext: {
      get: () => ({
        state: {
          auth: { strategy: { name: 'users-permissions' } },
          user: { id: 7 },
        },
      }),
    },
    db: {
      query: (uid: string) => ({
        findOne: async (params: Record<string, unknown>) => {
          const docId = (params.where as { documentId?: string } | undefined)
            ?.documentId;
          if (uid === 'plugin::users-permissions.user') {
            return {
              id: 7,
              email: 'user@example.com',
              role: { type: options.roleType },
              organizations: options.organizations.map((documentId) => ({
                documentId,
              })),
            };
          }
          if (uid === ASSET) return orgOf(options.assetOrg, docId);
          if (uid === TRANSACTION) return orgOf(options.transactionOrg, docId);
          return null;
        },
      }),
    },
  } as unknown as Pick<
    PublishGuardStrapi,
    'documents' | 'db' | 'requestContext'
  >;
  registerOrgScopeMiddleware(strapi);

  async function run(ctx: Ctx): Promise<Ctx> {
    let index = 0;
    const next = async (): Promise<unknown> =>
      index < stack.length ? stack[index++]!(ctx, next) : 'ok';
    await next();
    return ctx;
  }
  return { run };
}

const forbidden = (e: unknown) => e instanceof errors.ForbiddenError;

describe('asset org scope — configuration', () => {
  it('assets are org-scoped; asset categories are a global lookup', () => {
    assert.equal(ORG_SCOPED_DOCUMENT_UID_SET.has(ASSET), true);
    assert.equal(ORG_SCOPED_DOCUMENT_UID_SET.has(ASSET_CATEGORY), false);
    for (const roleType of ['dataentry', 'editor']) {
      assert.equal(
        shouldApplyOrgScope({
          uid: ASSET,
          action: 'findMany',
          strategyName: 'users-permissions',
          roleType,
        }),
        true,
        roleType,
      );
    }
    assert.equal(
      shouldApplyOrgScope({
        uid: ASSET,
        action: 'findMany',
        strategyName: 'users-permissions',
        roleType: 'controller',
      }),
      false,
    );
  });
});

describe('asset org scope — reads', () => {
  for (const roleType of ['dataentry', 'editor'] as const) {
    it(`${roleType} only lists assets of their own organizations`, async () => {
      const { run } = setup({ roleType, organizations: ['org-a', 'org-b'] });
      const ctx = await run({
        uid: ASSET,
        action: 'findMany',
        params: { filters: { name: { $containsi: 'traktor' } } },
      });
      assert.deepEqual(ctx.params?.filters, {
        $and: [
          { name: { $containsi: 'traktor' } },
          { organization: { documentId: { $in: ['org-a', 'org-b'] } } },
        ],
      });
    });
  }

  it('controller lists every asset (no org filter)', async () => {
    const { run } = setup({ roleType: 'controller', organizations: [] });
    const ctx = await run({
      uid: ASSET,
      action: 'findMany',
      params: { filters: { name: { $eq: 'x' } } },
    });
    assert.deepEqual(ctx.params?.filters, { name: { $eq: 'x' } });
  });

  it('a scoped user without memberships sees nothing', async () => {
    const { run } = setup({ roleType: 'editor', organizations: [] });
    const ctx = await run({ uid: ASSET, action: 'count', params: {} });
    assert.deepEqual(ctx.params?.filters, {
      organization: { documentId: { $eq: '__org_scope_no_membership__' } },
    });
  });
});

describe('asset org scope — writes', () => {
  it('dataentry creates an asset in their own organization', async () => {
    const { run } = setup({ roleType: 'dataentry', organizations: ['org-a'] });
    await run({
      uid: ASSET,
      action: 'create',
      params: { data: { name: 'Fűnyíró', organization: 'org-a' } },
    });
  });

  it('single-membership user gets the organization filled in', async () => {
    const { run } = setup({ roleType: 'dataentry', organizations: ['org-a'] });
    const ctx = await run({
      uid: ASSET,
      action: 'create',
      params: { data: { name: 'Fűnyíró' } },
    });
    assert.deepEqual(
      (ctx.params?.data as Record<string, unknown>).organization,
      {
        connect: ['org-a'],
      },
    );
  });

  for (const roleType of ['dataentry', 'editor'] as const) {
    it(`${roleType} cannot create an asset for another organization`, async () => {
      const { run } = setup({ roleType, organizations: ['org-a'] });
      await assert.rejects(
        () =>
          run({
            uid: ASSET,
            action: 'create',
            params: { data: { name: 'x', organization: 'org-z' } },
          }),
        forbidden,
      );
    });

    it(`${roleType} cannot update or delete an asset of another organization`, async () => {
      const { run } = setup({
        roleType,
        organizations: ['org-a'],
        assetOrg: { 'asset-z': 'org-z' },
      });
      for (const action of ['update', 'delete']) {
        await assert.rejects(
          () =>
            run({
              uid: ASSET,
              action,
              params: { documentId: 'asset-z', data: { name: 'y' } },
            }),
          forbidden,
          action,
        );
      }
    });
  }

  it('editor updates an own asset but cannot move it to a foreign org', async () => {
    const { run } = setup({
      roleType: 'editor',
      organizations: ['org-a'],
      assetOrg: { 'asset-a': 'org-a' },
    });
    await run({
      uid: ASSET,
      action: 'update',
      params: { documentId: 'asset-a', data: { status: 'in_storage' } },
    });
    await assert.rejects(
      () =>
        run({
          uid: ASSET,
          action: 'update',
          params: { documentId: 'asset-a', data: { organization: 'org-z' } },
        }),
      forbidden,
    );
  });

  it('linked acquisition/disposal transactions must be in an allowed org', async () => {
    const { run } = setup({
      roleType: 'editor',
      organizations: ['org-a'],
      assetOrg: { 'asset-a': 'org-a' },
      transactionOrg: { 'tx-a': 'org-a', 'tx-z': 'org-z' },
    });
    await run({
      uid: ASSET,
      action: 'create',
      params: {
        data: {
          name: 'Traktor',
          organization: 'org-a',
          acquisition_transaction: 'tx-a',
        },
      },
    });
    await assert.rejects(
      () =>
        run({
          uid: ASSET,
          action: 'create',
          params: {
            data: {
              name: 'Traktor',
              organization: 'org-a',
              acquisition_transaction: { connect: ['tx-z'] },
            },
          },
        }),
      forbidden,
    );
    await assert.rejects(
      () =>
        run({
          uid: ASSET,
          action: 'update',
          params: {
            documentId: 'asset-a',
            data: { disposal_transaction: 'tx-z' },
          },
        }),
      forbidden,
    );
  });

  it('controller writes assets of any organization', async () => {
    const { run } = setup({
      roleType: 'controller',
      organizations: [],
      assetOrg: { 'asset-z': 'org-z' },
      transactionOrg: { 'tx-z': 'org-z' },
    });
    await run({
      uid: ASSET,
      action: 'update',
      params: {
        documentId: 'asset-z',
        data: { organization: 'org-y', acquisition_transaction: 'tx-z' },
      },
    });
    await run({
      uid: ASSET,
      action: 'delete',
      params: { documentId: 'asset-z' },
    });
  });
});
