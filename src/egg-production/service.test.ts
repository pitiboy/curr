/**
 * egg-production/service.ts with a fake Strapi: multiple coops, pool legs,
 * internal vs sale distribution, anchor relations, atomic rollback,
 * duplicate handling (skip / replace / add), org scope, feature flag,
 * auto-publish (eggAuto rules) and dry run.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TRANSACTION_UID,
  TransactionWorkflowError,
  WORKFLOW_UID,
} from '../transaction-workflow/convert.ts';
import { EGG_WORKFLOW_TEMPLATE_NAMES } from './constants.ts';
import {
  EGG,
  HUF,
  POULTRY_ORG_ID,
  account,
  seededTemplates,
} from './egg-fixtures.test.helper.ts';
import {
  EGG_ERROR,
  submitEggEntries,
  type EggEntryRequestBody,
  type EggProductionStrapi,
} from './service.ts';

const DATE = '2026-11-18';

type StoredTx = {
  documentId: string;
  publishedAt: string | null;
  data: Record<string, unknown>;
};

type Op =
  | { kind: 'create'; documentId: string; data: Record<string, unknown> }
  | { kind: 'update'; documentId: string; data: Record<string, unknown> }
  | { kind: 'publish'; documentId: string; eggAuto: boolean; linked: boolean };

type FakeOptions = {
  roleType?: string;
  userOrgs?: string[];
  featureEnabled?: boolean;
  featureConfig?: Record<string, unknown>;
  existing?: StoredTx[];
  failOnCreate?: number;
  withRate?: boolean;
  templates?: boolean;
};

const coops = [
  { documentId: 'org-a', name: 'A ól' },
  { documentId: 'org-b', name: 'B ól' },
];

const orgNames: Record<string, string> = {
  'org-a': 'A ól',
  'org-b': 'B ól',
  [POULTRY_ORG_ID]: 'Tyúktartás',
};

const memberships = [
  {
    documentId: 'ms-1',
    name: 'Anna tagság',
    valid_from: '2025-01-01T00:00:00.000Z',
    valid_to: null,
    rules: { egg: { mode: 'internal', ratio: 1 } },
    membership_type: { name: 'Vásárló', rules: null },
    members: [
      {
        documentId: 'm-anna',
        name: 'Anna',
        account: { documentId: 'anna-1101', code: '1101' },
        private_account: { documentId: 'anna-1001', code: '1001' },
      },
    ],
  },
  {
    documentId: 'ms-2',
    name: 'Béla tagság',
    valid_from: '2025-01-01T00:00:00.000Z',
    valid_to: null,
    rules: null,
    // No rules JSON: fallback by type name → sale, ratio 0.75.
    membership_type: { name: 'Érdeklődő', rules: null },
    members: [
      {
        documentId: 'm-bela',
        name: 'Béla',
        account: null,
        private_account: { documentId: 'bela-1001', code: '1001' },
      },
    ],
  },
  {
    documentId: 'ms-3',
    name: 'Lejárt',
    valid_from: '2025-01-01T00:00:00.000Z',
    valid_to: '2025-12-31T00:00:00.000Z',
    rules: null,
    membership_type: { name: 'Bentlakó tag', rules: null },
    members: [{ documentId: 'm-old', name: 'Régi', private_account: null }],
  },
];

function buildStrapi(options: FakeOptions = {}) {
  let store: StoredTx[] = (options.existing ?? []).map((row) => ({
    ...row,
    data: { ...row.data },
  }));
  const ops: Op[] = [];
  let createCount = 0;
  const state: Record<string, unknown> = {};
  const templates = seededTemplates();

  const transactionDocs = {
    findMany: async () => [],
    create: async ({ data }: { data: Record<string, unknown> }) => {
      createCount += 1;
      if (options.failOnCreate && createCount === options.failOnCreate) {
        throw new Error('forced create failure');
      }
      const documentId = `tx-${createCount}`;
      store.push({ documentId, publishedAt: null, data: { ...data } });
      ops.push({ kind: 'create', documentId, data });
      return { documentId };
    },
    update: async ({
      documentId,
      data,
    }: {
      documentId: string;
      data: Record<string, unknown>;
    }) => {
      for (const row of store) {
        if (row.documentId === documentId && row.publishedAt === null) {
          row.data = { ...row.data, ...data };
        }
      }
      ops.push({ kind: 'update', documentId, data });
      return { documentId };
    },
    publish: async ({ documentId }: { documentId: string }) => {
      ops.push({
        kind: 'publish',
        documentId,
        eggAuto: state.eggWorkflowAutoFinalize === true,
        linked: state.publishGuardLinked === true,
      });
      return { documentId };
    },
  };

  const strapi: EggProductionStrapi = {
    documents: (uid: string) => {
      if (uid === 'api::setting.setting') {
        return {
          findMany: async () => [
            {
              key: 'egg-production',
              enabled: options.featureEnabled ?? true,
              config: options.featureConfig ?? {
                saleCurrency: 'HUF',
                initialPublicationStatus: 'draft',
              },
            },
          ],
        };
      }
      if (uid === WORKFLOW_UID) {
        return {
          findMany: async (params: {
            status?: string;
            filters?: { name?: { $in?: string[] } };
          }) => {
            assert.equal(params.status, 'draft');
            if (options.templates === false) return [];
            const names = params.filters?.name?.$in ?? [];
            return Object.values(templates).filter((row) =>
              names.includes(row.name!),
            );
          },
        };
      }
      if (uid === 'api::currency-rate.currency-rate') {
        return {
          findMany: async () =>
            options.withRate === false
              ? []
              : [
                  {
                    documentId: 'rate-1',
                    rate: 60,
                    valid_from: '2026-01-01T00:00:00.000Z',
                    from_currency_type: { documentId: EGG.documentId },
                    to_currency_type: { documentId: HUF.documentId },
                  },
                ],
        };
      }
      if (uid === TRANSACTION_UID) return transactionDocs;
      throw new Error(`unexpected documents(${uid})`);
    },
    db: {
      query: (uid: string) => ({
        findOne: async (params: Record<string, unknown>) => {
          const where = params.where as Record<string, unknown>;
          if (uid === 'plugin::users-permissions.user') {
            return {
              id: 1,
              role: { type: options.roleType ?? 'dataentry' },
              organizations: (
                options.userOrgs ?? ['org-a', 'org-b', POULTRY_ORG_ID]
              ).map((documentId) => ({
                documentId,
                name: orgNames[documentId],
              })),
            };
          }
          if (uid === 'api::organization.organization') {
            return where.name === 'Tyúktartás'
              ? { documentId: POULTRY_ORG_ID, name: 'Tyúktartás' }
              : null;
          }
          if (uid === 'api::currency-type.currency-type') {
            return (
              ({ EGG, HUF } as Record<string, unknown>)[String(where.code)] ??
              null
            );
          }
          throw new Error(`unexpected findOne ${uid}`);
        },
        findMany: async (params: Record<string, unknown>) => {
          if (uid === 'api::organization.organization') return coops;
          if (uid === 'api::membership.membership') return memberships;
          if (uid === TRANSACTION_UID) {
            const where = params.where as {
              date: string;
              organization: { documentId: { $in: string[] } };
            };
            return store
              .filter(
                (row) =>
                  row.data.date === where.date &&
                  where.organization.documentId.$in.includes(
                    String(row.data.organization),
                  ),
              )
              .map((row) => ({
                documentId: row.documentId,
                amount: row.data.amount,
                date: row.data.date,
                publishedAt: row.publishedAt,
                organization: { documentId: row.data.organization },
                currency_type: { documentId: row.data.currency_type },
                debit_account: { documentId: row.data.debit_account },
                credit_account: { documentId: row.data.credit_account },
              }));
          }
          throw new Error(`unexpected findMany ${uid}`);
        },
      }),
      transaction: async <T>(callback: () => Promise<T>): Promise<T> => {
        const snapshot = store.map((row) => ({
          ...row,
          data: { ...row.data },
        }));
        try {
          return await callback();
        } catch (error) {
          store = snapshot;
          throw error;
        }
      },
    },
    requestContext: { get: () => ({ state }) },
  };

  return { strapi, ops, store: () => store };
}

function body(
  overrides: Partial<EggEntryRequestBody> = {},
): EggEntryRequestBody {
  return {
    date: DATE,
    productions: [
      { organizationId: 'org-a', quantity: 120 },
      { organizationId: 'org-b', quantity: 80 },
    ],
    distributions: [
      { memberId: 'm-anna', quantity: 10 },
      { memberId: 'm-bela', quantity: 10 },
    ],
    ...overrides,
  };
}

async function rejectsWith(
  promise: Promise<unknown>,
  status: number,
  code: string,
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof TransactionWorkflowError, String(error));
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

function existingTx(
  documentId: string,
  data: Record<string, unknown>,
  publishedAt: string | null = null,
): StoredTx {
  return { documentId, publishedAt, data: { date: DATE, ...data } };
}

const productionA = {
  amount: 100,
  organization: 'org-a',
  currency_type: EGG.documentId,
  debit_account: account('1300').documentId,
  credit_account: account('4500').documentId,
};

describe('submitEggEntries — write', () => {
  it('books production + pool per coop and internal/sale distribution in one go', async () => {
    const { strapi, ops, store } = buildStrapi();
    const result = await submitEggEntries(strapi, {
      userId: 1,
      body: body(),
      dryRun: false,
    });
    const creates = ops.filter((op) => op.kind === 'create');
    // 2 productions + 4 pool legs + 1 internal + 3 sale legs.
    assert.equal(creates.length, 10);
    assert.equal(store().length, 10);
    assert.deepEqual(
      result.legs.map((leg) => [leg.key, leg.status]),
      [
        ['org-a:production', 'created'],
        ['org-b:production', 'created'],
        ['org-a:pool-coop-out', 'created'],
        ['org-a:pool-parent-in', 'created'],
        ['org-b:pool-coop-out', 'created'],
        ['org-b:pool-parent-in', 'created'],
        ['m-anna:internal', 'created'],
        ['m-bela:egg', 'created'],
        ['m-bela:cash', 'created'],
        ['m-bela:revenue', 'created'],
      ],
    );
    // Béla: Érdeklődő fallback → sale × 0.75 × 60.
    assert.equal(
      result.legs.find((leg) => leg.key === 'm-bela:cash')?.amount,
      450,
    );
    assert.equal(result.anchorDocumentId, 'tx-1');
    assert.equal(
      ops.some((op) => op.kind === 'publish'),
      false,
    );
  });

  it('links related_transaction: production anchor star, pool → own coop', async () => {
    const { strapi, ops } = buildStrapi();
    await submitEggEntries(strapi, { userId: 1, body: body(), dryRun: false });
    const related = ops
      .filter(
        (op): op is Extract<Op, { kind: 'create' }> => op.kind === 'create',
      )
      .map((op) => [op.documentId, op.data.related_transaction ?? null]);
    assert.deepEqual(related, [
      ['tx-1', null],
      ['tx-2', 'tx-1'],
      ['tx-3', 'tx-1'],
      ['tx-4', 'tx-1'],
      ['tx-5', 'tx-2'],
      ['tx-6', 'tx-2'],
      ['tx-7', 'tx-1'],
      ['tx-8', 'tx-1'],
      ['tx-9', 'tx-1'],
      ['tx-10', 'tx-1'],
    ]);
  });

  it('rolls back every write when one leg fails', async () => {
    const { strapi, store } = buildStrapi({ failOnCreate: 5 });
    await assert.rejects(
      submitEggEntries(strapi, { userId: 1, body: body(), dryRun: false }),
      (error: unknown) => {
        assert.ok(error instanceof TransactionWorkflowError);
        assert.equal(error.code, EGG_ERROR.writeFailed);
        assert.equal(error.details?.legKey, 'org-b:pool-coop-out');
        assert.match(error.message, /semmi nem került rögzítésre/);
        return true;
      },
    );
    assert.equal(store().length, 0);
  });

  it('dry run plans and reports without writing', async () => {
    const { strapi, ops } = buildStrapi();
    const result = await submitEggEntries(strapi, {
      userId: 1,
      body: body(),
      dryRun: true,
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.legs.length, 10);
    assert.ok(result.legs.every((leg) => leg.status === 'planned'));
    assert.equal(ops.length, 0);
  });

  it('member rules decide internal vs sale (Convert ignores mode)', async () => {
    const { strapi } = buildStrapi();
    const result = await submitEggEntries(strapi, {
      userId: 1,
      body: body({ productions: [] }),
      dryRun: true,
    });
    assert.deepEqual(
      result.legs.map((leg) => leg.kind),
      ['internal', 'sale-egg', 'sale-cash', 'sale-revenue'],
    );
  });

  it('a sale row without EGG → HUF rate fails with 422 before any write', async () => {
    const { strapi, ops } = buildStrapi({ withRate: false });
    await rejectsWith(
      submitEggEntries(strapi, { userId: 1, body: body(), dryRun: false }),
      422,
      'CURRENCY_RATE_MISSING',
    );
    assert.equal(ops.length, 0);
  });
});

describe('submitEggEntries — duplicates', () => {
  const existing = [
    existingTx('old-a', productionA, '2026-11-18T10:00:00.000Z'),
  ];

  it('409 with the conflict list when no conflictChoice is given', async () => {
    const { strapi, ops } = buildStrapi({ existing });
    await assert.rejects(
      submitEggEntries(strapi, { userId: 1, body: body(), dryRun: false }),
      (error: unknown) => {
        assert.ok(error instanceof TransactionWorkflowError);
        assert.equal(error.status, 409);
        assert.equal(error.code, EGG_ERROR.conflictChoiceRequired);
        const conflicts = error.details?.conflicts as {
          key: string;
          existingAmount: number;
        }[];
        assert.deepEqual(
          conflicts.map((row) => [row.key, row.existingAmount]),
          [['org-a:production', 100]],
        );
        return true;
      },
    );
    assert.equal(ops.length, 0);
  });

  it('skip keeps the existing row and uses it as the anchor', async () => {
    const { strapi, ops } = buildStrapi({ existing });
    const result = await submitEggEntries(strapi, {
      userId: 1,
      body: body({ distributions: [], conflictChoice: 'skip' }),
      dryRun: false,
    });
    assert.equal(result.legs[0]!.status, 'skipped');
    assert.equal(result.anchorDocumentId, 'old-a');
    const creates = ops.filter(
      (op): op is Extract<Op, { kind: 'create' }> => op.kind === 'create',
    );
    assert.equal(creates.length, 5);
    assert.ok(
      creates.every(
        (op) =>
          op.data.related_transaction === 'old-a' ||
          op.data.related_transaction === 'tx-1',
      ),
    );
    assert.equal(
      result.legs.find((leg) => leg.key === 'org-a:pool-coop-out')
        ?.relatedDocumentId,
      'old-a',
    );
  });

  it('replace updates the existing row; add inserts a new one', async () => {
    const replace = buildStrapi({ existing });
    await submitEggEntries(replace.strapi, {
      userId: 1,
      body: body({ distributions: [], conflictChoice: 'replace' }),
      dryRun: false,
    });
    const updates = replace.ops.filter((op) => op.kind === 'update');
    assert.deepEqual(
      updates.map((op) => op.documentId),
      ['old-a'],
    );
    assert.equal((updates[0] as { data: { amount: number } }).data.amount, 120);

    const add = buildStrapi({ existing });
    await submitEggEntries(add.strapi, {
      userId: 1,
      body: body({ distributions: [], conflictChoice: 'add' }),
      dryRun: false,
    });
    assert.equal(add.ops.filter((op) => op.kind === 'update').length, 0);
    assert.equal(add.ops.filter((op) => op.kind === 'create').length, 6);
  });

  it('per-coop choice overrides the global one', async () => {
    const { strapi, ops } = buildStrapi({ existing });
    const result = await submitEggEntries(strapi, {
      userId: 1,
      body: body({
        distributions: [],
        conflictChoice: 'replace',
        conflictChoices: { 'org-a': 'skip' },
      }),
      dryRun: false,
    });
    assert.equal(result.legs[0]!.status, 'skipped');
    assert.equal(ops.filter((op) => op.kind === 'update').length, 0);
  });

  it('dry run lists conflicts without failing', async () => {
    const { strapi } = buildStrapi({ existing });
    const result = await submitEggEntries(strapi, {
      userId: 1,
      body: body(),
      dryRun: true,
    });
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.legs[0]!.status, 'conflict');
  });
});

describe('submitEggEntries — access', () => {
  it('feature flag off → 403', async () => {
    const { strapi } = buildStrapi({ featureEnabled: false });
    await rejectsWith(
      submitEggEntries(strapi, { userId: 1, body: body(), dryRun: false }),
      403,
      EGG_ERROR.featureDisabled,
    );
  });

  it('unauthenticated → 401; other roles → 403', async () => {
    const { strapi } = buildStrapi();
    await rejectsWith(
      submitEggEntries(strapi, { userId: null, body: body(), dryRun: false }),
      401,
      EGG_ERROR.unauthenticated,
    );
    const other = buildStrapi({ roleType: 'authenticated' });
    await rejectsWith(
      submitEggEntries(other.strapi, {
        userId: 1,
        body: body(),
        dryRun: false,
      }),
      403,
      EGG_ERROR.roleForbidden,
    );
  });

  it('dataentry outside its organizations → 403, nothing written', async () => {
    const coopOnly = buildStrapi({ userOrgs: ['org-a'] });
    await assert.rejects(
      submitEggEntries(coopOnly.strapi, {
        userId: 1,
        body: body({
          productions: [{ organizationId: 'org-a', quantity: 5 }],
          distributions: [],
        }),
        dryRun: false,
      }),
      (error: unknown) => {
        assert.ok(error instanceof TransactionWorkflowError);
        assert.equal(error.status, 403);
        assert.equal(error.code, EGG_ERROR.orgScopeDenied);
        assert.deepEqual(error.details?.organizations, ['Tyúktartás']);
        return true;
      },
    );
    assert.equal(coopOnly.ops.length, 0);

    const editor = buildStrapi({
      roleType: 'editor',
      userOrgs: ['org-a', POULTRY_ORG_ID],
    });
    await rejectsWith(
      submitEggEntries(editor.strapi, {
        userId: 1,
        body: body(),
        dryRun: true,
      }),
      403,
      EGG_ERROR.orgScopeDenied,
    );
  });

  it('controller may book any organization', async () => {
    const { strapi, ops } = buildStrapi({
      roleType: 'controller',
      userOrgs: [],
    });
    await submitEggEntries(strapi, { userId: 1, body: body(), dryRun: false });
    assert.equal(ops.filter((op) => op.kind === 'create').length, 10);
  });

  it('settings roles restrict the form server-side', async () => {
    const { strapi } = buildStrapi({
      featureConfig: { roles: ['editor'] },
    });
    await rejectsWith(
      submitEggEntries(strapi, { userId: 1, body: body(), dryRun: false }),
      403,
      EGG_ERROR.roleForbidden,
    );
  });
});

describe('submitEggEntries — auto publish', () => {
  it('publishes every written leg with linked eggAuto context when the setting allows', async () => {
    const { strapi, ops } = buildStrapi({
      featureConfig: { initialPublicationStatus: 'published' },
    });
    const result = await submitEggEntries(strapi, {
      userId: 1,
      body: body({ publish: true }),
      dryRun: false,
    });
    const publishes = ops.filter(
      (op): op is Extract<Op, { kind: 'publish' }> => op.kind === 'publish',
    );
    assert.equal(publishes.length, 10);
    assert.ok(publishes.every((op) => op.eggAuto && op.linked));
    assert.equal(result.autoPublish, true);
    assert.ok(result.legs.every((leg) => leg.published));
  });

  it('ignores publish when the setting keeps drafts', async () => {
    const { strapi, ops } = buildStrapi();
    const result = await submitEggEntries(strapi, {
      userId: 1,
      body: body({ publish: true }),
      dryRun: false,
    });
    assert.equal(
      ops.some((op) => op.kind === 'publish'),
      false,
    );
    assert.equal(result.autoPublish, false);
  });
});

describe('submitEggEntries — validation', () => {
  it('rejects bad dates, quantities and unknown rows with 400', async () => {
    const { strapi } = buildStrapi();
    const cases: EggEntryRequestBody[] = [
      body({ date: '18/11/2026' }),
      body({ productions: [{ organizationId: 'org-a', quantity: 1.5 }] }),
      body({ productions: [{ organizationId: 'org-x', quantity: 5 }] }),
      body({ distributions: [{ memberId: 'm-old', quantity: 5 }] }),
      body({ productions: [], distributions: [] }),
      body({ conflictChoice: 'overwrite' }),
    ];
    for (const request of cases) {
      await rejectsWith(
        submitEggEntries(strapi, { userId: 1, body: request, dryRun: true }),
        400,
        EGG_ERROR.validation,
      );
    }
  });

  it('missing templates → 422 with the template name', async () => {
    const { strapi } = buildStrapi({ templates: false });
    await assert.rejects(
      submitEggEntries(strapi, { userId: 1, body: body(), dryRun: true }),
      (error: unknown) => {
        assert.ok(error instanceof TransactionWorkflowError);
        assert.equal(error.code, EGG_ERROR.templateMissing);
        assert.match(
          error.message,
          new RegExp(EGG_WORKFLOW_TEMPLATE_NAMES.productionPool.slice(0, 10)),
        );
        return true;
      },
    );
  });
});
