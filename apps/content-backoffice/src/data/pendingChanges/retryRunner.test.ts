import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataProvider } from 'react-admin';

import {
  clearTestPendingChangeUser,
  setTestPendingChangeUser,
} from './currentUser';
import { PENDING_CHANGES_RETRY_INTERVAL_MS } from './constants';
import { enqueuePendingChange, listPendingChangesForUser } from './store';
import { useLocalStoragePersistenceForTests } from './persistence';
import { createPendingChangesRetryRunner } from './retryRunner';
import * as tabLock from './tabLock';

describe('pendingChanges retryRunner', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    useLocalStoragePersistenceForTests();
    await useLocalStoragePersistenceForTests().reset();
    setTestPendingChangeUser({ userId: 3, username: 'retry-user' });
    vi.spyOn(tabLock, 'withPendingChangesSendLock').mockImplementation(
      async (fn) => fn(),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearTestPendingChangeUser();
  });

  function provider(
    behavior: (item: { method: string }) => Promise<unknown>,
  ): DataProvider {
    return {
      getList: async () => ({ data: [], total: 0 }),
      getOne: async () => ({ data: { id: '1' } }),
      getMany: async () => ({ data: [] }),
      getManyReference: async () => ({ data: [], total: 0 }),
      create: vi.fn(async () => behavior({ method: 'create' })),
      update: vi.fn(async () => behavior({ method: 'update' })),
      delete: vi.fn(async () => behavior({ method: 'delete' })),
    };
  }

  it('retries on interval and removes on success', async () => {
    let calls = 0;
    const inner = provider(async () => {
      calls += 1;
      return { data: { id: 'new' } };
    });
    await enqueuePendingChange({
      resource: 'transactions',
      operation: 'create',
      payload: {
        kind: 'dataProvider',
        method: 'create',
        resource: 'transactions',
        params: { data: { amount: 10 } },
      },
      status: 'pending',
      lastError: null,
    });
    const invalidate = vi.fn();
    const runner = createPendingChangesRetryRunner(inner, invalidate, {
      innerProvider: inner,
      intervalMs: PENDING_CHANGES_RETRY_INTERVAL_MS,
    });
    runner.start();
    await vi.runOnlyPendingTimersAsync();
    expect(calls).toBe(1);
    const items = await listPendingChangesForUser({
      userId: 3,
      username: 'retry-user',
    });
    expect(items).toHaveLength(0);
    expect(invalidate).toHaveBeenCalledWith('transactions');
    runner.stop();
  });

  it('increments attemptCount on retryable failure', async () => {
    const inner = provider(async () => {
      throw Object.assign(new Error('503'), { status: 503 });
    });
    await enqueuePendingChange({
      resource: 'transactions',
      operation: 'update',
      payload: {
        kind: 'dataProvider',
        method: 'update',
        resource: 'transactions',
        params: { id: 'doc-9', data: {} },
      },
      status: 'pending',
      lastError: null,
    });
    const runner = createPendingChangesRetryRunner(inner, vi.fn(), {
      innerProvider: inner,
    });
    await runner.runOnce();
    const items = await listPendingChangesForUser({
      userId: 3,
      username: 'retry-user',
    });
    expect(items[0]?.attemptCount).toBe(1);
    expect(items[0]?.lastError).toContain('503');
  });

  it('keeps FIFO order per record', async () => {
    const order: string[] = [];
    const inner = provider(async ({ method }) => {
      order.push(method);
      return { data: { id: 'x' } };
    });
    await enqueuePendingChange({
      resource: 'transactions',
      operation: 'update',
      payload: {
        kind: 'dataProvider',
        method: 'update',
        resource: 'transactions',
        params: { id: 'same', data: { amount: 1 } },
      },
      status: 'pending',
      lastError: null,
    });
    await enqueuePendingChange({
      resource: 'transactions',
      operation: 'update',
      payload: {
        kind: 'dataProvider',
        method: 'update',
        resource: 'transactions',
        params: { id: 'same', data: { amount: 2 } },
      },
      status: 'pending',
      lastError: null,
    });
    const runner = createPendingChangesRetryRunner(inner, vi.fn(), {
      innerProvider: inner,
    });
    await runner.runOnce();
    expect(order).toEqual(['update']);
    const items = await listPendingChangesForUser({
      userId: 3,
      username: 'retry-user',
    });
    expect(items).toHaveLength(1);
  });
});
