import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readAuditConfig } from '../audit/config';
import { AUDIT_LOG_UID, writeAuditEntry } from '../audit/sink';
import auditLogMiddleware from './audit-log';

function createStrapi(overrides?: { createThrows?: boolean }) {
  const logs: Array<{ level: string; payload: Record<string, unknown> }> = [];
  const creates: unknown[] = [];
  const savedEnv = {
    AUDIT_LOG_ENABLED: process.env.AUDIT_LOG_ENABLED,
    AUDIT_LOG_SINK: process.env.AUDIT_LOG_SINK,
  };
  if (process.env.AUDIT_LOG_ENABLED === undefined) {
    process.env.AUDIT_LOG_ENABLED = 'true';
  }
  if (process.env.AUDIT_LOG_SINK === undefined) {
    process.env.AUDIT_LOG_SINK = 'both';
  }

  const strapi = {
    log: {
      info: (payload: Record<string, unknown>, message: string) => {
        logs.push({ level: 'info', payload: { ...payload, message } });
      },
      warn: (payload: Record<string, unknown>, message: string) => {
        logs.push({ level: 'warn', payload: { ...payload, message } });
      },
    },
    db: {
      query: (uid: string) => {
        assert.equal(uid, AUDIT_LOG_UID);
        return {
          create: async ({ data }: { data: unknown }) => {
            if (overrides?.createThrows) {
              throw new Error('db down');
            }
            creates.push(data);
          },
        };
      },
    },
  };

  return {
    strapi,
    logs,
    creates,
    restoreEnv() {
      if (savedEnv.AUDIT_LOG_ENABLED === undefined) {
        delete process.env.AUDIT_LOG_ENABLED;
      } else {
        process.env.AUDIT_LOG_ENABLED = savedEnv.AUDIT_LOG_ENABLED;
      }
      if (savedEnv.AUDIT_LOG_SINK === undefined) {
        delete process.env.AUDIT_LOG_SINK;
      } else {
        process.env.AUDIT_LOG_SINK = savedEnv.AUDIT_LOG_SINK;
      }
    },
  };
}

function createCtx(overrides?: Partial<Record<string, unknown>>) {
  const headers: Record<string, string> = {};
  return {
    method: 'POST',
    path: '/api/transactions',
    status: 201,
    state: {},
    body: undefined,
    request: {
      body: { description: 'test' },
      query: {},
      ip: '127.0.0.1',
    },
    query: {},
    get(name: string) {
      const key = name.toLowerCase();
      if (key === 'x-request-id') {
        return headers['x-request-id'];
      }
      if (key === 'user-agent') {
        return 'curl';
      }
      return undefined;
    },
    set(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    headers,
    ...overrides,
  };
}

describe('audit-log middleware', () => {
  it('skips when disabled', async () => {
    const saved = process.env.AUDIT_LOG_ENABLED;
    process.env.AUDIT_LOG_ENABLED = 'false';
    const { strapi, creates, restoreEnv } = createStrapi();
    const handler = auditLogMiddleware({}, { strapi } as never);
    const ctx = createCtx();
    let nextCalled = false;
    await handler(ctx as never, async () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(creates.length, 0);
    restoreEnv();
    if (saved === undefined) {
      delete process.env.AUDIT_LOG_ENABLED;
    } else {
      process.env.AUDIT_LOG_ENABLED = saved;
    }
  });

  it('writes an entry on success and sets X-Request-Id', async () => {
    const { strapi, creates, restoreEnv } = createStrapi();
    const handler = auditLogMiddleware({}, { strapi } as never);
    const ctx = createCtx({
      state: {
        auth: { strategy: { name: 'users-permissions' } },
        user: { id: 3, email: 'u@example.com', role: { type: 'editor' } },
      },
    });
    await handler(ctx as never, async () => undefined);
    assert.equal(creates.length, 1);
    const row = creates[0] as Record<string, unknown>;
    assert.equal(row.actor_type, 'user');
    assert.equal(row.status, 201);
    assert.equal(ctx.get('x-request-id'), ctx.headers['x-request-id']);
    restoreEnv();
  });

  it('rethrows errors but still audits', async () => {
    const { strapi, creates, restoreEnv } = createStrapi();
    const handler = auditLogMiddleware({}, { strapi } as never);
    const ctx = createCtx({ path: '/api/transactions' });
    await assert.rejects(
      handler(ctx as never, async () => {
        const err = new Error('boom') as Error & { status?: number };
        err.status = 422;
        throw err;
      }),
    );
    assert.equal(creates.length, 1);
    assert.equal((creates[0] as Record<string, unknown>).status, 422);
    restoreEnv();
  });

  it('does not fail the request when db sink throws', async () => {
    const { strapi, logs, restoreEnv } = createStrapi({ createThrows: true });
    const handler = auditLogMiddleware({}, { strapi } as never);
    const ctx = createCtx();
    await handler(ctx as never, async () => undefined);
    assert.ok(logs.some((entry) => entry.level === 'warn'));
    restoreEnv();
  });
});

describe('writeAuditEntry', () => {
  it('stdout sink skips db', async () => {
    const creates: unknown[] = [];
    const cfg = readAuditConfig({ AUDIT_LOG_SINK: 'stdout' });
    const strapi = {
      log: {
        info: () => undefined,
        warn: () => undefined,
      },
      db: {
        query: () => ({
          create: async ({ data }: { data: unknown }) => {
            creates.push(data);
          },
        }),
      },
    };
    await writeAuditEntry(strapi, cfg, { method: 'POST' });
    assert.equal(creates.length, 0);
  });
});
