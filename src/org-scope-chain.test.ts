/**
 * Holistic Document Service chain tests for org scoping.
 *
 * Registers the middleware in the same order as `src/index.ts`
 * (`registerOrgScopeMiddleware` → `registerPublishGuard`) and terminates the
 * chain in a tiny in-memory store that really evaluates `filters`
 * (`$and`, `$in`, `$eq`, `$containsi`, nested relations). Assertions are on
 * the returned rows and on the stored state, not only on mutated params.
 *
 * Mirrors Strapi 5 document-service behaviour that matters for scoping:
 * - `findOne` honours `filters` (they become part of the `where`),
 * - `update` / `publish` look up by `documentId` only (filters are ignored),
 *   so the middleware must probe access itself.
 * - Nested `strapi.documents(uid)` calls (publish guard → linked receipts)
 *   run through the same middleware chain.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { errors } from '@strapi/utils';

import { registerOrgScopeMiddleware } from './org-scope-middleware.ts';
import {
  deleteTransactionWithReceipts,
  purgeExpansion,
  TransactionDeleteError,
  type TransactionDeleteStrapi,
} from './transaction-delete/delete-service.ts';
import {
  DEFAULT_PUBLISH_POLICY,
  registerPublishGuard,
  type PublishGuardStrapi,
} from './publish-guard.ts';

const TX = 'api::transaction.transaction';
const RECEIPT = 'api::receipt.receipt';
const ORG = 'api::organization.organization';
const ACCOUNT = 'api::account.account';
const USER = 'plugin::users-permissions.user';

const NO_MEMBERSHIP = '__org_scope_no_membership__';

type Row = Record<string, unknown>;
type Filter = Record<string, unknown>;
type Params = Record<string, unknown>;
type Middleware = (
  context: { uid: string; action: string; params?: Params },
  next: () => Promise<unknown>,
) => Promise<unknown>;

type UserRow = {
  id: number;
  email: string;
  role: string;
  organizations: string[];
};

/** Users by key; ids are stable so the request context can reference them. */
const USERS = {
  dataentryA: {
    id: 1,
    email: 'de-a@example.com',
    role: 'dataentry',
    organizations: ['org-a'],
  },
  dataentryNone: {
    id: 2,
    email: 'de-none@example.com',
    role: 'dataentry',
    organizations: [],
  },
  dataentryAB: {
    id: 3,
    email: 'de-ab@example.com',
    role: 'dataentry',
    organizations: ['org-a', 'org-b'],
  },
  editorAB: {
    id: 4,
    email: 'ed-ab@example.com',
    role: 'editor',
    organizations: ['org-a', 'org-b'],
  },
  editorNone: {
    id: 5,
    email: 'ed-none@example.com',
    role: 'editor',
    organizations: [],
  },
  controller: {
    id: 6,
    email: 'ctrl@example.com',
    role: 'controller',
    organizations: [],
  },
  authenticated: {
    id: 7,
    email: 'auth@example.com',
    role: 'authenticated',
    organizations: [],
  },
} satisfies Record<string, UserRow>;

type UserKey = keyof typeof USERS;

function seedTransaction(
  id: number,
  documentId: string,
  organization: string | null,
  extra: Row = {},
): Row {
  return {
    id,
    documentId,
    description: `tx ${documentId}`,
    date: '2026-01-15',
    amount: 100,
    currency_type: { id: 1, documentId: 'cur-huf' },
    debit_account: { id: 11, documentId: 'acc-1101' },
    credit_account: { id: 12, documentId: 'acc-1001' },
    organization,
    entered_by: 'de-a@example.com',
    published_by: null,
    publishedAt: null,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Filter evaluation (subset of Strapi query operators used by the middleware)
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Row {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function applyOperator(value: unknown, op: string, arg: unknown): boolean {
  switch (op) {
    case '$eq':
      return value === arg;
    case '$ne':
      return value !== arg;
    case '$in':
      return Array.isArray(arg) && arg.includes(value);
    case '$containsi':
      return (
        typeof value === 'string' &&
        value.toLowerCase().includes(String(arg).toLowerCase())
      );
    case '$null':
      return (value == null) === Boolean(arg);
    default:
      throw new Error(`test store: unsupported operator ${op}`);
  }
}

function matches(row: unknown, filter: Filter): boolean {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '$and') return (cond as Filter[]).every((f) => matches(row, f));
    if (key === '$or') return (cond as Filter[]).some((f) => matches(row, f));
    if (key.startsWith('$')) return applyOperator(row, key, cond);
    const value = isPlainObject(row) ? row[key] : undefined;
    if (isPlainObject(cond)) return matches(value, cond);
    return value === cond;
  });
}

/** Accepts `'id'`, `{ documentId }`, `{ connect: [...] }`, `{ set: [...] }`. */
function relationTarget(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return relationTarget(value[0]);
  if (!isPlainObject(value)) return undefined;
  if (typeof value.documentId === 'string') return value.documentId;
  if ('set' in value) return relationTarget(value.set) ?? null;
  if ('connect' in value) return relationTarget(value.connect);
  return undefined;
}

// ---------------------------------------------------------------------------
// World: fake Strapi + in-memory store + chain runner
// ---------------------------------------------------------------------------

function createWorld() {
  const organizations: Row[] = [
    { id: 1, documentId: 'org-a', name: 'Alfa' },
    { id: 2, documentId: 'org-b', name: 'Béta' },
    { id: 3, documentId: 'org-c', name: 'Cé' },
  ];
  const transactions: Row[] = [
    seedTransaction(1, 'tx-a1', 'org-a', { description: 'termelés tojás' }),
    seedTransaction(2, 'tx-a2', 'org-a', { description: 'eladás piac' }),
    seedTransaction(3, 'tx-b1', 'org-b', { description: 'osztás tojás' }),
    seedTransaction(4, 'tx-c1', 'org-c', { description: 'átvezetés pool' }),
    seedTransaction(5, 'tx-noorg', null, { description: 'félkész piszkozat' }),
  ];
  const receipts: Row[] = [
    { id: 1, documentId: 'rc-a1', transaction: 'tx-a1', publishedAt: null },
    { id: 2, documentId: 'rc-b1', transaction: 'tx-b1', publishedAt: null },
    { id: 3, documentId: 'rc-c1', transaction: 'tx-c1', publishedAt: null },
  ];
  const accounts: Row[] = [
    { id: 11, documentId: 'acc-1101', code: 1101 },
    { id: 12, documentId: 'acc-1001', code: 1001 },
  ];
  const tables: Record<string, Row[]> = {
    [ORG]: organizations,
    [TX]: transactions,
    [RECEIPT]: receipts,
    [ACCOUNT]: accounts,
  };
  let nextId = 100;

  const orgRef = (documentId: unknown) =>
    typeof documentId === 'string'
      ? (organizations.find((o) => o.documentId === documentId) ?? null)
      : null;

  /** Populate relations the way the middleware / guard expect them. */
  function hydrate(uid: string, row: Row): Row {
    if (uid === TX) {
      return { ...row, organization: orgRef(row.organization) };
    }
    if (uid === RECEIPT) {
      const tx = transactions.find((t) => t.documentId === row.transaction);
      return { ...row, transaction: tx ? hydrate(TX, tx) : null };
    }
    return { ...row };
  }

  function select(uid: string, filters: unknown, status?: unknown): Row[] {
    const table = tables[uid];
    if (!table) throw new Error(`test store: unknown uid ${uid}`);
    return table
      .map((row) => hydrate(uid, row))
      .filter((row) => (isPlainObject(filters) ? matches(row, filters) : true))
      .filter((row) => (status === 'draft' ? row.publishedAt == null : true));
  }

  function applyData(uid: string, row: Row, data: Row) {
    for (const [key, value] of Object.entries(data)) {
      if (uid === TX && key === 'organization') {
        row.organization = relationTarget(value) ?? null;
      } else if (uid === RECEIPT && key === 'transaction') {
        row.transaction = relationTarget(value) ?? null;
      } else {
        row[key] = value;
      }
    }
  }

  /** Terminal handler: what the Strapi document repository would do. */
  async function execute(uid: string, action: string, params: Params = {}) {
    const table = tables[uid]!;
    const byDocumentId = () =>
      table.find((r) => r.documentId === params.documentId);
    switch (action) {
      case 'findMany':
        return select(uid, params.filters, params.status);
      case 'findFirst':
        return select(uid, params.filters, params.status)[0] ?? null;
      case 'count':
        return select(uid, params.filters, params.status).length;
      case 'findOne':
        return (
          select(uid, params.filters, params.status).find(
            (r) => r.documentId === params.documentId,
          ) ?? null
        );
      case 'create': {
        const id = nextId++;
        const row: Row = {
          id,
          documentId: `${uid.split('.').pop()}-new-${id}`,
          publishedAt: null,
        };
        applyData(uid, row, (params.data as Row) ?? {});
        table.push(row);
        return hydrate(uid, row);
      }
      case 'update': {
        // Strapi 5 update looks up by documentId only (filters are ignored).
        const row = byDocumentId();
        if (!row) return null;
        applyData(uid, row, (params.data as Row) ?? {});
        return hydrate(uid, row);
      }
      case 'publish': {
        const row = byDocumentId();
        if (!row) return null;
        row.publishedAt = '2026-11-10T00:00:00.000Z';
        return { documentId: row.documentId, entries: [hydrate(uid, row)] };
      }
      case 'delete': {
        const idx = table.findIndex((r) => r.documentId === params.documentId);
        if (idx >= 0) table.splice(idx, 1);
        return { documentId: params.documentId };
      }
      case 'clone':
      case 'discardDraft':
      case 'unpublish':
        return { documentId: params.documentId };
      default:
        throw new Error(`test store: unsupported action ${action}`);
    }
  }

  const stack: Middleware[] = [];
  /** Every params object that reached the store (after all middleware). */
  const executed: Array<{ uid: string; action: string; params: Params }> = [];

  async function run(uid: string, action: string, params?: Params) {
    const context: { uid: string; action: string; params?: Params } = {
      uid,
      action,
      params,
    };
    let index = 0;
    const next = async (): Promise<unknown> => {
      if (index < stack.length) return stack[index++]!(context, next);
      executed.push({ uid, action, params: context.params ?? {} });
      return execute(uid, action, context.params);
    };
    return next();
  }

  let requestState: Row | undefined;

  const documents = Object.assign(
    (uid: string) =>
      new Proxy(
        {},
        {
          get: (_t, action: string) => (params?: Params) =>
            run(uid, action, params),
        },
      ),
    { use: (fn: Middleware) => stack.push(fn) },
  ) as unknown as PublishGuardStrapi['documents'];

  const users = Object.values(USERS) as UserRow[];

  const db = {
    query: (uid: string) => ({
      findOne: async ({ where }: Row) => {
        const w = (where ?? {}) as Row;
        if (uid === USER) {
          const user = users.find((u) => u.id === w.id);
          if (!user) return null;
          return {
            id: user.id,
            email: user.email,
            role: { type: user.role },
            organizations: user.organizations.map((documentId) => ({
              documentId,
            })),
          };
        }
        const table = tables[uid] ?? [];
        const row = table.find((r) => r.documentId === w.documentId);
        if (!row) return null;
        const draftOnly = isPlainObject(w.publishedAt);
        if (draftOnly && row.publishedAt != null) return null;
        return hydrate(uid, row);
      },
      update: async ({ where, data }: { where: { id: number }; data: Row }) => {
        const row = (tables[uid] ?? []).find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row ?? null;
      },
      // Raw db layer (no middleware), as used by transaction-delete.
      findMany: async ({ where }: Row) => select(uid, where),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        for (const row of tables[uid] ?? []) {
          if (matches(hydrate(uid, row), where)) Object.assign(row, data);
        }
      },
    }),
  };

  const strapi = {
    documents,
    db,
    requestContext: { get: () => requestState },
    log: { warn: () => {} },
    plugin: () => ({ service: () => ({ remove: async () => undefined }) }),
  } as unknown as PublishGuardStrapi;

  // Same order as src/index.ts register().
  registerOrgScopeMiddleware(strapi);
  registerPublishGuard(strapi, async () => ({ ...DEFAULT_PUBLISH_POLICY }));

  return {
    tables,
    executed,
    strapi,
    docs: (uid: string) =>
      strapi.documents(uid) as unknown as Record<
        string,
        (params?: Params) => Promise<unknown>
      >,
    /** Content API request as a users-permissions user. */
    as(key: UserKey) {
      requestState = {
        state: {
          auth: { strategy: { name: 'users-permissions' } },
          user: { id: USERS[key].id },
        },
      };
    },
    /** Admin panel (Content Manager) request. */
    asAdmin() {
      requestState = {
        state: { auth: { strategy: { name: 'admin' } }, user: { id: 1 } },
      };
    },
    /** Bootstrap / cron / seeder: no request context at all. */
    asSystem() {
      requestState = undefined;
    },
    txRow: (documentId: string) =>
      transactions.find((t) => t.documentId === documentId),
    receiptRow: (documentId: string) =>
      receipts.find((r) => r.documentId === documentId),
  };
}

type World = ReturnType<typeof createWorld>;

const ids = (rows: unknown) =>
  (rows as Row[]).map((r) => r.documentId as string).sort();

const forbidden = (e: unknown) => e instanceof errors.ForbiddenError;
const invalid = (e: unknown) => e instanceof errors.ValidationError;

function draftTxData(extra: Row = {}): Row {
  return {
    date: '2026-02-01',
    amount: 12,
    currency_type: 'cur-huf',
    description: 'új ügylet',
    ...extra,
  };
}

let w: World;
beforeEach(() => {
  w = createWorld();
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

describe('org scope chain — dataentry reads (single org)', () => {
  beforeEach(() => w.as('dataentryA'));

  it('lists only transactions of the linked organization', async () => {
    const rows = await w.docs(TX).findMany!({});
    assert.deepEqual(ids(rows), ['tx-a1', 'tx-a2']);
  });

  it('works without any params (filters created from scratch)', async () => {
    const rows = await w.docs(TX).findMany!();
    assert.deepEqual(ids(rows), ['tx-a1', 'tx-a2']);
  });

  it('keeps caller filters and intersects them with the org scope', async () => {
    const rows = await w.docs(TX).findMany!({
      filters: { description: { $containsi: 'tojás' } },
    });
    // tx-b1 also matches "tojás" but is in org-b.
    assert.deepEqual(ids(rows), ['tx-a1']);
  });

  it('cannot widen scope with an explicit filter for another org', async () => {
    const rows = await w.docs(TX).findMany!({
      filters: { organization: { documentId: { $eq: 'org-b' } } },
    });
    assert.deepEqual(ids(rows), []);
  });

  it('cannot widen scope with an $or filter', async () => {
    const rows = await w.docs(TX).findMany!({
      filters: {
        $or: [
          { organization: { documentId: { $eq: 'org-b' } } },
          { organization: { documentId: { $eq: 'org-c' } } },
        ],
      },
    });
    assert.deepEqual(ids(rows), []);
  });

  it('hides transactions without an organization', async () => {
    const one = await w.docs(TX).findOne!({ documentId: 'tx-noorg' });
    assert.equal(one, null);
  });

  it('count respects the scope', async () => {
    assert.equal(await w.docs(TX).count!({}), 2);
  });

  it('findFirst respects the scope', async () => {
    const row = (await w.docs(TX).findFirst!({
      filters: { description: { $containsi: 'osztás' } },
    })) as Row | null;
    assert.equal(row, null);
  });

  it('findOne returns own-org document and null for a foreign one', async () => {
    const own = (await w.docs(TX).findOne!({ documentId: 'tx-a1' })) as Row;
    assert.equal(own.documentId, 'tx-a1');
    assert.equal(await w.docs(TX).findOne!({ documentId: 'tx-b1' }), null);
  });

  it('lists receipts only through own-org transactions', async () => {
    assert.deepEqual(ids(await w.docs(RECEIPT).findMany!({})), ['rc-a1']);
    assert.equal(await w.docs(RECEIPT).findOne!({ documentId: 'rc-b1' }), null);
  });

  it('organization list shows only the linked organizations', async () => {
    assert.deepEqual(ids(await w.docs(ORG).findMany!({})), ['org-a']);
  });

  it('leaves non-allowlisted content types unfiltered', async () => {
    const params: Params = { filters: { code: { $eq: 1101 } } };
    const rows = await w.docs(ACCOUNT).findMany!(params);
    assert.deepEqual(ids(rows), ['acc-1101']);
    assert.deepEqual(params.filters, { code: { $eq: 1101 } });
    assert.deepEqual(ids(await w.docs(ACCOUNT).findMany!({})), [
      'acc-1001',
      'acc-1101',
    ]);
  });
});

describe('org scope chain — dataentry with multiple organizations', () => {
  beforeEach(() => w.as('dataentryAB'));

  it('lists the union of linked organizations', async () => {
    assert.deepEqual(ids(await w.docs(TX).findMany!({})), [
      'tx-a1',
      'tx-a2',
      'tx-b1',
    ]);
    assert.deepEqual(ids(await w.docs(ORG).findMany!({})), ['org-a', 'org-b']);
    assert.deepEqual(ids(await w.docs(RECEIPT).findMany!({})), [
      'rc-a1',
      'rc-b1',
    ]);
  });
});

describe('org scope chain — dataentry without membership (placeholder filter)', () => {
  beforeEach(() => w.as('dataentryNone'));

  it('injects the no-membership sentinel and returns nothing', async () => {
    const params: Params = {};
    const rows = await w.docs(TX).findMany!(params);
    assert.deepEqual(rows, []);
    assert.deepEqual(params.filters, {
      organization: { documentId: { $eq: NO_MEMBERSHIP } },
    });
  });

  it('sentinel is merged with caller filters via $and', async () => {
    const params: Params = { filters: { description: { $containsi: 'x' } } };
    await w.docs(TX).findMany!(params);
    assert.deepEqual(params.filters, {
      $and: [
        { description: { $containsi: 'x' } },
        { organization: { documentId: { $eq: NO_MEMBERSHIP } } },
      ],
    });
  });

  it('sees no transactions, receipts or organizations; count is 0', async () => {
    assert.deepEqual(await w.docs(TX).findMany!({}), []);
    assert.deepEqual(await w.docs(RECEIPT).findMany!({}), []);
    assert.deepEqual(await w.docs(ORG).findMany!({}), []);
    assert.equal(await w.docs(TX).count!({}), 0);
    assert.equal(await w.docs(TX).findOne!({ documentId: 'tx-a1' }), null);
  });

  it('does not see unorganized transactions through the sentinel', async () => {
    assert.equal(await w.docs(TX).findOne!({ documentId: 'tx-noorg' }), null);
  });

  it('still reads non-allowlisted content types', async () => {
    assert.equal(((await w.docs(ACCOUNT).findMany!({})) as Row[]).length, 2);
  });
});

describe('org scope chain — editor reads', () => {
  it('editor with two orgs sees both orgs, not the third', async () => {
    w.as('editorAB');
    assert.deepEqual(ids(await w.docs(TX).findMany!({})), [
      'tx-a1',
      'tx-a2',
      'tx-b1',
    ]);
    assert.equal(await w.docs(TX).findOne!({ documentId: 'tx-c1' }), null);
    assert.deepEqual(ids(await w.docs(ORG).findMany!({})), ['org-a', 'org-b']);
    assert.deepEqual(ids(await w.docs(RECEIPT).findMany!({})), [
      'rc-a1',
      'rc-b1',
    ]);
  });

  it('editor without membership sees nothing scoped', async () => {
    w.as('editorNone');
    assert.deepEqual(await w.docs(TX).findMany!({}), []);
    assert.deepEqual(await w.docs(ORG).findMany!({}), []);
  });
});

// ---------------------------------------------------------------------------
// Bypass / unscoped callers
// ---------------------------------------------------------------------------

describe('org scope chain — bypass and unscoped callers', () => {
  const ALL_TX = ['tx-a1', 'tx-a2', 'tx-b1', 'tx-c1', 'tx-noorg'];

  it('controller sees every transaction, receipt and organization', async () => {
    w.as('controller');
    assert.deepEqual(ids(await w.docs(TX).findMany!({})), ALL_TX);
    assert.equal(((await w.docs(RECEIPT).findMany!({})) as Row[]).length, 3);
    assert.equal(((await w.docs(ORG).findMany!({})) as Row[]).length, 3);
  });

  it('controller can update and create outside any membership', async () => {
    w.as('controller');
    await w.docs(TX).update!({
      documentId: 'tx-c1',
      status: 'draft',
      data: { description: 'controller javítás' },
    });
    assert.equal(w.txRow('tx-c1')!.description, 'controller javítás');

    const params: Params = { status: 'draft', data: draftTxData() };
    const created = (await w.docs(TX).create!(params)) as Row;
    // No organization is injected for the bypass role.
    assert.equal(created.organization, null);
    assert.equal('organization' in (params.data as Row), false);
  });

  it('admin panel (admin strategy) is unscoped', async () => {
    w.asAdmin();
    assert.deepEqual(ids(await w.docs(TX).findMany!({})), ALL_TX);
  });

  it('system calls without request context are unscoped', async () => {
    w.asSystem();
    assert.deepEqual(ids(await w.docs(TX).findMany!({})), ALL_TX);
    await w.docs(TX).update!({
      documentId: 'tx-b1',
      data: { description: 'cron' },
    });
    assert.equal(w.txRow('tx-b1')!.description, 'cron');
  });

  it('a U&P role outside the scoped set passes through unfiltered', async () => {
    w.as('authenticated');
    const params: Params = {};
    assert.deepEqual(ids(await w.docs(TX).findMany!(params)), ALL_TX);
    assert.equal(params.filters, undefined);
  });

  it('updateComponents is never filtered', async () => {
    w.as('dataentryNone');
    const params: Params = { filters: { a: 1 } };
    const { executed } = w;
    // Call the chain directly; the store does not implement this action,
    // so stop right before it by asserting on the middleware outcome.
    await assert.rejects(
      () => w.docs(TX).updateComponents!(params),
      /unsupported action updateComponents/,
    );
    assert.deepEqual(params.filters, { a: 1 });
    assert.equal(executed.at(-1)!.action, 'updateComponents');
  });
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

describe('org scope chain — dataentry create', () => {
  it('single membership: organization is auto-connected', async () => {
    w.as('dataentryA');
    const created = (await w.docs(TX).create!({
      status: 'draft',
      data: draftTxData(),
    })) as Row;
    const stored = w.txRow(created.documentId as string)!;
    assert.equal(stored.organization, 'org-a');
    // Publish guard ran after org scope in the same chain.
    assert.equal(stored.entered_by, USERS.dataentryA.email);
  });

  for (const [label, organization] of [
    ['string documentId', 'org-a'],
    ['{ documentId }', { documentId: 'org-a' }],
    ['connect: [string]', { connect: ['org-a'] }],
    ['connect: [{ documentId }]', { connect: [{ documentId: 'org-a' }] }],
    ['connect: { documentId }', { connect: { documentId: 'org-a' } }],
  ] as const) {
    it(`accepts own organization given as ${label}`, async () => {
      w.as('dataentryA');
      const created = (await w.docs(TX).create!({
        status: 'draft',
        data: draftTxData({ organization }),
      })) as Row;
      assert.equal(
        w.txRow(created.documentId as string)!.organization,
        'org-a',
      );
    });
  }

  for (const [label, organization] of [
    ['string documentId', 'org-b'],
    ['{ documentId }', { documentId: 'org-b' }],
    ['connect: [string]', { connect: ['org-b'] }],
    ['connect: [{ documentId }]', { connect: [{ documentId: 'org-b' }] }],
    ['connect mixing own and foreign', { connect: ['org-a', 'org-b'] }],
    ['set: [string]', { set: ['org-b'] }],
    ['set: [{ documentId }]', { set: [{ documentId: 'org-b' }] }],
  ] as const) {
    it(`rejects foreign organization given as ${label}`, async () => {
      w.as('dataentryA');
      const before = w.tables[TX]!.length;
      await assert.rejects(
        () =>
          w.docs(TX).create!({
            status: 'draft',
            data: draftTxData({ organization }),
          }),
        forbidden,
      );
      assert.equal(w.tables[TX]!.length, before, 'nothing was stored');
    });
  }

  it('no membership: create is forbidden and nothing is stored', async () => {
    w.as('dataentryNone');
    const before = w.tables[TX]!.length;
    await assert.rejects(
      () => w.docs(TX).create!({ status: 'draft', data: draftTxData() }),
      forbidden,
    );
    assert.equal(w.tables[TX]!.length, before);
  });

  it('multiple memberships without organization → validation error', async () => {
    w.as('dataentryAB');
    await assert.rejects(
      () => w.docs(TX).create!({ status: 'draft', data: draftTxData() }),
      invalid,
    );
  });

  it('multiple memberships with an explicit own organization → ok', async () => {
    w.as('dataentryAB');
    const created = (await w.docs(TX).create!({
      status: 'draft',
      data: draftTxData({ organization: 'org-b' }),
    })) as Row;
    assert.equal(w.txRow(created.documentId as string)!.organization, 'org-b');
  });

  it('org scope passes but publish guard still blocks published create', async () => {
    w.as('dataentryA');
    await assert.rejects(
      () =>
        w.docs(TX).create!({
          status: 'published',
          data: draftTxData({ organization: 'org-a' }),
        }),
      forbidden,
    );
  });

  it('org scope passes but publish guard still enforces draft fields', async () => {
    w.as('dataentryA');
    await assert.rejects(
      () =>
        w.docs(TX).create!({
          status: 'draft',
          data: { description: 'hiányos' },
        }),
      invalid,
    );
  });

  it('receipt create on an own-org transaction is allowed', async () => {
    w.as('dataentryA');
    const created = (await w.docs(RECEIPT).create!({
      status: 'draft',
      data: { transaction: { connect: ['tx-a1'] } },
    })) as Row;
    assert.equal(
      w.receiptRow(created.documentId as string)!.transaction,
      'tx-a1',
    );
  });

  it('receipt create on a foreign transaction is forbidden', async () => {
    w.as('dataentryA');
    await assert.rejects(
      () =>
        w.docs(RECEIPT).create!({
          status: 'draft',
          data: { transaction: 'tx-b1' },
        }),
      forbidden,
    );
  });

  it('receipt create on an unorganized transaction is forbidden', async () => {
    w.as('dataentryA');
    await assert.rejects(
      () =>
        w.docs(RECEIPT).create!({
          status: 'draft',
          data: { transaction: { documentId: 'tx-noorg' } },
        }),
      forbidden,
    );
  });

  it('receipt create without transaction → validation error', async () => {
    w.as('dataentryA');
    await assert.rejects(
      () => w.docs(RECEIPT).create!({ status: 'draft', data: {} }),
      invalid,
    );
  });

  it('receipt create without membership is forbidden', async () => {
    w.as('dataentryNone');
    await assert.rejects(
      () =>
        w.docs(RECEIPT).create!({
          status: 'draft',
          data: { transaction: 'tx-a1' },
        }),
      forbidden,
    );
  });
});

describe('org scope chain — editor create', () => {
  beforeEach(() => w.as('editorAB'));

  it('two memberships without organization → validation error', async () => {
    await assert.rejects(
      () => w.docs(TX).create!({ status: 'draft', data: draftTxData() }),
      invalid,
    );
  });

  it('creates for either own organization', async () => {
    for (const org of ['org-a', 'org-b']) {
      const created = (await w.docs(TX).create!({
        status: 'draft',
        data: draftTxData({ organization: { connect: [org] } }),
      })) as Row;
      assert.equal(w.txRow(created.documentId as string)!.organization, org);
      assert.equal(
        w.txRow(created.documentId as string)!.entered_by,
        USERS.editorAB.email,
      );
    }
  });

  it('cannot create for a non-member organization', async () => {
    await assert.rejects(
      () =>
        w.docs(TX).create!({
          status: 'draft',
          data: draftTxData({ organization: 'org-c' }),
        }),
      forbidden,
    );
  });

  it('receipt on foreign transaction is forbidden for editor too', async () => {
    await assert.rejects(
      () =>
        w.docs(RECEIPT).create!({
          status: 'draft',
          data: { transaction: 'tx-c1' },
        }),
      forbidden,
    );
  });

  it('editor without membership cannot create', async () => {
    w.as('editorNone');
    await assert.rejects(
      () =>
        w.docs(TX).create!({
          status: 'draft',
          data: draftTxData({ organization: 'org-a' }),
        }),
      forbidden,
    );
  });
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

describe('org scope chain — dataentry update', () => {
  beforeEach(() => w.as('dataentryA'));

  it('updates an own-org transaction', async () => {
    await w.docs(TX).update!({
      documentId: 'tx-a1',
      status: 'draft',
      data: { description: 'módosítva' },
    });
    assert.equal(w.txRow('tx-a1')!.description, 'módosítva');
  });

  it('re-pointing to the same organization is allowed', async () => {
    await w.docs(TX).update!({
      documentId: 'tx-a1',
      status: 'draft',
      data: { organization: { connect: ['org-a'] } },
    });
    assert.equal(w.txRow('tx-a1')!.organization, 'org-a');
  });

  it('cannot update a foreign-org transaction (store unchanged)', async () => {
    await assert.rejects(
      () =>
        w.docs(TX).update!({
          documentId: 'tx-b1',
          status: 'draft',
          data: { description: 'betörés' },
        }),
      forbidden,
    );
    assert.equal(w.txRow('tx-b1')!.description, 'osztás tojás');
  });

  it('cannot move an own transaction to a foreign organization', async () => {
    await assert.rejects(
      () =>
        w.docs(TX).update!({
          documentId: 'tx-a1',
          status: 'draft',
          data: { organization: { connect: [{ documentId: 'org-b' }] } },
        }),
      forbidden,
    );
    assert.equal(w.txRow('tx-a1')!.organization, 'org-a');
  });

  it('cannot update an unorganized transaction', async () => {
    await assert.rejects(
      () =>
        w.docs(TX).update!({
          documentId: 'tx-noorg',
          status: 'draft',
          data: { organization: 'org-a' },
        }),
      forbidden,
    );
    assert.equal(w.txRow('tx-noorg')!.organization, null);
  });

  it('unknown documentId is forbidden (no existence leak via 404)', async () => {
    await assert.rejects(
      () =>
        w.docs(TX).update!({
          documentId: 'tx-missing',
          status: 'draft',
          data: { description: 'x' },
        }),
      forbidden,
    );
  });

  it('updates an own-org receipt', async () => {
    await w.docs(RECEIPT).update!({
      documentId: 'rc-a1',
      status: 'draft',
      data: { note: 'ok' },
    });
    assert.equal(w.receiptRow('rc-a1')!.note, 'ok');
  });

  it('cannot update a foreign-org receipt', async () => {
    await assert.rejects(
      () =>
        w.docs(RECEIPT).update!({
          documentId: 'rc-b1',
          status: 'draft',
          data: { note: 'x' },
        }),
      forbidden,
    );
    assert.equal(w.receiptRow('rc-b1')!.note, undefined);
  });

  it('cannot re-link an own receipt to a foreign transaction', async () => {
    await assert.rejects(
      () =>
        w.docs(RECEIPT).update!({
          documentId: 'rc-a1',
          status: 'draft',
          data: { transaction: { connect: ['tx-b1'] } },
        }),
      forbidden,
    );
    assert.equal(w.receiptRow('rc-a1')!.transaction, 'tx-a1');
  });

  it('cannot re-link an own receipt to a foreign transaction via set', async () => {
    await assert.rejects(
      () =>
        w.docs(RECEIPT).update!({
          documentId: 'rc-a1',
          status: 'draft',
          data: { transaction: { set: [{ documentId: 'tx-c1' }] } },
        }),
      forbidden,
    );
    assert.equal(w.receiptRow('rc-a1')!.transaction, 'tx-a1');
  });

  it('cannot move an own transaction away via set', async () => {
    await assert.rejects(
      () =>
        w.docs(TX).update!({
          documentId: 'tx-a2',
          status: 'draft',
          data: { organization: { set: ['org-c'] } },
        }),
      forbidden,
    );
    assert.equal(w.txRow('tx-a2')!.organization, 'org-a');
  });

  it('can re-link an own receipt to another own transaction', async () => {
    await w.docs(RECEIPT).update!({
      documentId: 'rc-a1',
      status: 'draft',
      data: { transaction: 'tx-a2' },
    });
    assert.equal(w.receiptRow('rc-a1')!.transaction, 'tx-a2');
  });

  it('no membership: every update is forbidden', async () => {
    w.as('dataentryNone');
    await assert.rejects(
      () =>
        w.docs(TX).update!({
          documentId: 'tx-a1',
          status: 'draft',
          data: { description: 'x' },
        }),
      forbidden,
    );
    await assert.rejects(
      () =>
        w.docs(RECEIPT).update!({
          documentId: 'rc-a1',
          status: 'draft',
          data: { note: 'x' },
        }),
      forbidden,
    );
  });
});

describe('org scope chain — editor update', () => {
  beforeEach(() => w.as('editorAB'));

  it('updates transactions in both member organizations', async () => {
    for (const documentId of ['tx-a1', 'tx-b1']) {
      await w.docs(TX).update!({
        documentId,
        status: 'draft',
        data: { description: `editor ${documentId}` },
      });
      assert.equal(w.txRow(documentId)!.description, `editor ${documentId}`);
    }
  });

  it('moves a transaction between member organizations', async () => {
    await w.docs(TX).update!({
      documentId: 'tx-a1',
      status: 'draft',
      data: { organization: 'org-b' },
    });
    assert.equal(w.txRow('tx-a1')!.organization, 'org-b');
  });

  it('cannot move a transaction to a non-member organization', async () => {
    await assert.rejects(
      () =>
        w.docs(TX).update!({
          documentId: 'tx-a1',
          status: 'draft',
          data: { organization: { set: ['org-c'] } },
        }),
      forbidden,
    );
    assert.equal(w.txRow('tx-a1')!.organization, 'org-a');
  });

  it('cannot update a non-member transaction or receipt', async () => {
    await assert.rejects(
      () =>
        w.docs(TX).update!({
          documentId: 'tx-c1',
          status: 'draft',
          data: { description: 'x' },
        }),
      forbidden,
    );
    await assert.rejects(
      () =>
        w.docs(RECEIPT).update!({
          documentId: 'rc-c1',
          status: 'draft',
          data: { note: 'x' },
        }),
      forbidden,
    );
  });

  it('updates a receipt in a member organization', async () => {
    await w.docs(RECEIPT).update!({
      documentId: 'rc-b1',
      status: 'draft',
      data: { note: 'editor' },
    });
    assert.equal(w.receiptRow('rc-b1')!.note, 'editor');
  });

  it('editor without membership cannot update', async () => {
    w.as('editorNone');
    await assert.rejects(
      () =>
        w.docs(TX).update!({
          documentId: 'tx-a1',
          status: 'draft',
          data: { description: 'x' },
        }),
      forbidden,
    );
  });
});

// ---------------------------------------------------------------------------
// Lifecycle (publish / delete / clone / discardDraft)
// ---------------------------------------------------------------------------

describe('org scope chain — lifecycle actions', () => {
  it('editor publishes an own-org transaction; linked receipt follows through the chain', async () => {
    w.as('editorAB');
    await w.docs(TX).publish!({ documentId: 'tx-a1' });
    assert.notEqual(w.txRow('tx-a1')!.publishedAt, null);
    assert.equal(w.txRow('tx-a1')!.published_by, USERS.editorAB.email);
    // publishLinkedReceipts → documents(RECEIPT).findMany/publish, both scoped.
    assert.notEqual(w.receiptRow('rc-a1')!.publishedAt, null);
    const receiptRead = w.executed.find(
      (e) => e.uid === RECEIPT && e.action === 'findMany',
    );
    assert.deepEqual(receiptRead!.params.filters, {
      $and: [
        { transaction: { documentId: { $eq: 'tx-a1' } } },
        {
          transaction: {
            organization: { documentId: { $in: ['org-a', 'org-b'] } },
          },
        },
      ],
    });
  });

  it('editor cannot publish a non-member transaction', async () => {
    w.as('editorAB');
    await assert.rejects(
      () => w.docs(TX).publish!({ documentId: 'tx-c1' }),
      forbidden,
    );
    assert.equal(w.txRow('tx-c1')!.publishedAt, null);
    assert.equal(w.receiptRow('rc-c1')!.publishedAt, null);
  });

  it('dataentry publish of an own transaction is still blocked by the publish guard', async () => {
    w.as('dataentryA');
    await assert.rejects(
      () => w.docs(TX).publish!({ documentId: 'tx-a1' }),
      forbidden,
    );
    assert.equal(w.txRow('tx-a1')!.publishedAt, null);
  });

  for (const action of ['delete', 'unpublish', 'discardDraft', 'clone']) {
    it(`${action} on a foreign transaction is forbidden for dataentry`, async () => {
      w.as('dataentryA');
      await assert.rejects(
        () => w.docs(TX)[action]!({ documentId: 'tx-b1' }),
        forbidden,
      );
      assert.ok(w.txRow('tx-b1'), 'row still exists');
    });
  }

  it('discardDraft on an own transaction passes the org scope (editor)', async () => {
    w.as('editorAB');
    await w.docs(TX).discardDraft!({ documentId: 'tx-a1' });
    assert.equal(w.executed.at(-1)!.action, 'discardDraft');
  });

  it('delete on a foreign receipt is forbidden', async () => {
    w.as('editorAB');
    await assert.rejects(
      () => w.docs(RECEIPT).delete!({ documentId: 'rc-c1' }),
      forbidden,
    );
    assert.ok(w.receiptRow('rc-c1'));
  });

  it('controller can delete anywhere', async () => {
    w.as('controller');
    await w.docs(TX).delete!({ documentId: 'tx-c1' });
    assert.equal(w.txRow('tx-c1'), undefined);
  });
});

// ---------------------------------------------------------------------------
// Controller delete / purge-expansion through the same chain (plan 0007)
// ---------------------------------------------------------------------------

describe('org scope chain — transaction-delete service', () => {
  const svc = () => w.strapi as unknown as TransactionDeleteStrapi;

  it('controller deletes a transaction of any organization with its receipts', async () => {
    w.as('controller');
    const result = await deleteTransactionWithReceipts(svc(), 'tx-c1');
    assert.deepEqual(result.deleted, ['tx-c1']);
    assert.deepEqual(result.receipts, ['rc-c1']);
    assert.equal(w.txRow('tx-c1'), undefined);
    assert.equal(w.receiptRow('rc-c1'), undefined);
    // Both deletes reached the store unfiltered (controller bypass).
    assert.deepEqual(
      w.executed.map((e) => `${e.action}:${e.uid}`),
      [`delete:${RECEIPT}`, `delete:${TX}`],
    );
  });

  it('controller purges an expansion across the chain and resets the original', async () => {
    w.as('controller');
    const txs = w.tables[TX]!;
    w.txRow('tx-a1')!.converted_to_workflow = 'original';
    txs.push(
      seedTransaction(40, 'tx-a1-step', 'org-a', {
        converted_to_workflow: 'expanded',
        related_transaction: { documentId: 'tx-a1' },
      }),
      seedTransaction(41, 'tx-a1-storno', 'org-a', {
        converted_to_workflow: 'storno',
        related_transaction: { documentId: 'tx-a1' },
      }),
    );
    const result = await purgeExpansion(svc(), 'tx-a1');
    assert.deepEqual(result.deleted, ['tx-a1-step', 'tx-a1-storno']);
    assert.equal(w.txRow('tx-a1')!.converted_to_workflow, null);
    assert.ok(w.txRow('tx-a1'), 'original kept');
    assert.ok(w.receiptRow('rc-a1'), "original's receipt kept");
  });

  for (const key of ['editorAB', 'dataentryA'] as const) {
    it(`${key} is rejected by the service before any document is deleted`, async () => {
      w.as(key);
      await assert.rejects(
        () => deleteTransactionWithReceipts(svc(), 'tx-a1'),
        (e: unknown) => e instanceof TransactionDeleteError && e.status === 403,
      );
      assert.deepEqual(w.executed, []);
      assert.ok(w.txRow('tx-a1'));
    });
  }
});
