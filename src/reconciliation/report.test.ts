import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertReconciliationController } from './auth';
import { handleReconciliation } from './handler';
import { buildReconciliationReport, type ReconciliationStrapi } from './report';

type Row = Record<string, unknown>;

function makeStrapi(options: {
  rows: Record<string, Row[]>;
  auth?: boolean;
}): ReconciliationStrapi {
  const queryFor = (uid: string) => {
    const list = options.rows[uid] ?? [];
    return {
      findMany: async (params: Record<string, unknown>) => {
        const where = (params.where ?? {}) as Record<string, unknown>;
        return list.filter((row) => matchesWhere(row, where));
      },
      findOne: async (params: Record<string, unknown>) => {
        const where = (params.where ?? {}) as Record<string, unknown>;
        return list.find((row) => matchesWhere(row, where)) ?? null;
      },
    };
  };

  return {
    requestContext: {
      get: () =>
        options.auth === false
          ? undefined
          : {
              state: {
                auth: { strategy: { name: 'users-permissions' } },
                user: { id: 1 },
              },
            },
    },
    db: {
      query: (uid: string) => queryFor(uid),
    },
  } as unknown as ReconciliationStrapi;
}

function matchesWhere(row: Row, where: Record<string, unknown>): boolean {
  for (const [key, clause] of Object.entries(where)) {
    if (key === '$or') {
      const or = clause as Record<string, unknown>[];
      if (!or.some((part) => matchesWhere(row, part))) return false;
      continue;
    }
    if (key === '$and') {
      const and = clause as Record<string, unknown>[];
      if (!and.every((part) => matchesWhere(row, part))) return false;
      continue;
    }
    const value = row[key];
    if (clause && typeof clause === 'object') {
      const filter = clause as Record<string, unknown>;
      if ('$null' in filter) {
        const expectNull = filter.$null === true;
        if (expectNull ? value != null : value == null) return false;
      }
      if ('$notNull' in filter) {
        if (filter.$notNull === true && value == null) return false;
      }
      if ('$eq' in filter && value !== filter.$eq) return false;
      if ('$in' in filter) {
        const list = filter.$in as unknown[];
        if (!list.includes(value)) return false;
      }
      if ('$gte' in filter || '$lte' in filter) {
        const left = String(value ?? '');
        const gte = filter.$gte;
        const lte = filter.$lte;
        if (gte != null && left < String(gte)) return false;
        if (lte != null && left > String(lte)) return false;
      }
      if (typeof value === 'object' && value != null && !Array.isArray(value)) {
        if (!matchesWhere(value as Row, filter)) return false;
      }
    } else if (value !== clause) {
      return false;
    }
  }
  return true;
}

const contentUsers: Row[] = [
  {
    id: 1,
    email: 'ctrl@example.com',
    role: { type: 'controller', name: 'controller' },
  },
  {
    id: 2,
    email: 'idle@example.com',
    username: 'idle',
    blocked: false,
    role: { type: 'dataentry', name: 'dataentry' },
  },
  {
    id: 3,
    email: 'bad@example.com',
    username: 'bad',
    role: null,
  },
];

describe('reconciliation report', () => {
  const baseRows: Record<string, Row[]> = {
    'api::transaction.transaction': [
      {
        id: 1,
        documentId: 'tx-draft',
        publishedAt: null,
        converted_to_workflow: null,
        date: '2026-01-01',
        amount: '10',
        description: 'draft',
        entered_by: 'a@test.com',
      },
      {
        id: 2,
        documentId: 'tx-published',
        publishedAt: '2026-01-02T00:00:00.000Z',
        converted_to_workflow: null,
        date: '2026-01-02',
        amount: '20',
        description: 'no receipt',
        published_by: 'e@test.com',
      },
      {
        id: 9,
        documentId: 'tx-original',
        publishedAt: '2026-01-03T00:00:00.000Z',
        converted_to_workflow: 'original',
        date: '2026-01-03',
        amount: '1',
        description: 'hidden original',
      },
    ],
    'api::receipt.receipt': [
      {
        id: 10,
        documentId: 'rc-orphan',
        transaction: null,
        date: '2026-01-04',
        amount: '5',
        vendor: 'X',
        description: 'orphan',
      },
    ],
    'api::member.member': [
      {
        documentId: 'm-1',
        identifier: 'alice',
        name: 'Alice',
        email: 'alice@test.com',
        memberships: [],
        account: { documentId: 'acc-1', code: '1101' },
        private_account: null,
        id: 1,
      },
    ],
    'api::membership.membership': [
      {
        documentId: 'ms-1',
        name: 'Empty group',
        members: [],
        organization: { name: 'Org' },
      },
    ],
    'api::account.account': [
      {
        id: 99,
        documentId: 'acc-orphan',
        code: '1101',
        name: 'Orphan 1101',
      },
    ],
    'api::audit-log.audit-log': [
      {
        actor_type: 'user',
        actor_id: '2',
        path: '/api/auth/local',
        status: 200,
        occurred_at: new Date().toISOString(),
      },
    ],
    'plugin::users-permissions.user': contentUsers,
  };

  it('aggregates section counts for a controller', async () => {
    const strapi = makeStrapi({ rows: baseRows });
    const report = await buildReconciliationReport(strapi);
    const byKey = Object.fromEntries(
      report.sections.map((section) => [section.key, section.count]),
    );
    assert.equal(byKey.draftTransactions, 1);
    assert.equal(byKey.orphanReceipts, 1);
    assert.equal(byKey.publishedWithoutReceipts, 1);
    assert.equal(byKey.membersWithoutMembership, 1);
    assert.equal(byKey.membershipsWithoutMembers, 1);
    assert.equal(byKey.membersMissingLedgerAccounts, 1);
    assert.equal(byKey.orphanMemberAccounts, 1);
    assert.equal(byKey.usersInvalidRole, 1);
    assert.equal(byKey.usersInactive, 2);
  });

  it('rejects non-controller callers with 403', async () => {
    const rows = {
      ...baseRows,
      'plugin::users-permissions.user': contentUsers.map((user) =>
        user.id === 1
          ? { ...user, role: { type: 'editor', name: 'editor' } }
          : user,
      ),
    };
    const strapi = makeStrapi({ rows });
    await assert.rejects(
      () => assertReconciliationController(strapi),
      (error: unknown) => {
        assert.equal((error as { status?: number }).status, 403);
        return true;
      },
    );
    const ctx: { status?: number; body?: unknown } = {};
    await handleReconciliation(strapi, ctx);
    assert.equal(ctx.status, 403);
  });
});
