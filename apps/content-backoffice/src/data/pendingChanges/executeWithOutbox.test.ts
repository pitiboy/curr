import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearTestPendingChangeUser,
  setTestPendingChangeUser,
} from './currentUser';
import { PendingChangeEnqueuedError } from './enqueuedError';
import { executeWithOutbox } from './executeWithOutbox';
import { listPendingChangesForUser } from './store';
import { configureLocalStoragePersistenceForTests } from './persistence';
import * as notifyModule from './notify';

describe('executeWithOutbox enqueue policy', () => {
  beforeEach(async () => {
    configureLocalStoragePersistenceForTests();
    await configureLocalStoragePersistenceForTests().reset();
    setTestPendingChangeUser({ userId: 9, username: 'u9' });
    vi.spyOn(notifyModule, 'notifyPendingChangeEnqueued').mockImplementation(
      () => {},
    );
  });

  afterEach(() => {
    clearTestPendingChangeUser();
  });

  it('enqueues retryable failures', async () => {
    await expect(
      executeWithOutbox({
        resource: 'transactions',
        operation: 'create',
        payload: {
          kind: 'dataProvider',
          method: 'create',
          resource: 'transactions',
          params: { data: {} },
        },
        run: async () => {
          throw new TypeError('Failed to fetch');
        },
      }),
    ).rejects.toBeInstanceOf(PendingChangeEnqueuedError);
    const items = await listPendingChangesForUser({
      userId: 9,
      username: 'u9',
    });
    expect(items[0]?.status).toBe('pending');
    expect(notifyModule.notifyPendingChangeEnqueued).toHaveBeenCalled();
  });

  it('enqueues 503 as pending', async () => {
    await expect(
      executeWithOutbox({
        resource: 'transactions',
        operation: 'update',
        payload: {
          kind: 'dataProvider',
          method: 'update',
          resource: 'transactions',
          params: { id: 'd1', data: {} },
        },
        run: async () => {
          throw Object.assign(new Error('upstream'), { status: 503 });
        },
      }),
    ).rejects.toBeInstanceOf(PendingChangeEnqueuedError);
    const items = await listPendingChangesForUser({
      userId: 9,
      username: 'u9',
    });
    expect(items[0]?.status).toBe('pending');
  });

  it('marks 422 as failed-permanent', async () => {
    await expect(
      executeWithOutbox({
        resource: 'transactions',
        operation: 'update',
        payload: {
          kind: 'dataProvider',
          method: 'update',
          resource: 'transactions',
          params: { id: 'd1', data: {} },
        },
        run: async () => {
          throw Object.assign(new Error('invalid'), { status: 422 });
        },
      }),
    ).rejects.toThrow(/invalid/);
    const items = await listPendingChangesForUser({
      userId: 9,
      username: 'u9',
    });
    expect(items[0]?.status).toBe('failed-permanent');
  });

  it('does not enqueue on success', async () => {
    await executeWithOutbox({
      resource: 'transactions',
      operation: 'delete',
      payload: {
        kind: 'dataProvider',
        method: 'delete',
        resource: 'transactions',
        params: { id: 'd1' },
      },
      run: async () => 'ok',
    });
    const items = await listPendingChangesForUser({
      userId: 9,
      username: 'u9',
    });
    expect(items).toHaveLength(0);
  });

  it('awaits a slow successful write without racing a wall-clock timeout', async () => {
    vi.useFakeTimers();
    try {
      let resolveRun!: (value: string) => void;
      const run = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveRun = resolve;
          }),
      );
      const pending = executeWithOutbox({
        resource: 'transactions',
        operation: 'create',
        payload: {
          kind: 'dataProvider',
          method: 'create',
          resource: 'transactions',
          params: { data: {} },
        },
        run,
      });
      await vi.advanceTimersByTimeAsync(30_000);
      resolveRun('ok');
      await expect(pending).resolves.toBe('ok');
      const items = await listPendingChangesForUser({
        userId: 9,
        username: 'u9',
      });
      expect(items).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('enqueues immediately when navigator.onLine is false', async () => {
    const run = vi.fn(async () => 'should-not-run');
    vi.stubGlobal('navigator', { onLine: false });
    try {
      await expect(
        executeWithOutbox({
          resource: 'transactions',
          operation: 'create',
          payload: {
            kind: 'dataProvider',
            method: 'create',
            resource: 'transactions',
            params: { data: { amount: 1 } },
          },
          run,
        }),
      ).rejects.toThrow(/Failed to fetch/);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(run).not.toHaveBeenCalled();
    const items = await listPendingChangesForUser({
      userId: 9,
      username: 'u9',
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe('pending');
    expect(notifyModule.notifyPendingChangeEnqueued).toHaveBeenCalled();
  });
});
