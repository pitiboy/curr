import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearTestPendingChangeUser,
  setTestPendingChangeUser,
} from './currentUser';
import {
  enqueuePendingChange,
  listPendingChangesForUser,
  removePendingChange,
  updatePendingChange,
} from './store';
import { useLocalStoragePersistenceForTests } from './persistence';

describe('pendingChanges store', () => {
  beforeEach(async () => {
    useLocalStoragePersistenceForTests();
    await useLocalStoragePersistenceForTests().reset();
    setTestPendingChangeUser({ userId: 7, username: 'demo' });
  });

  afterEach(() => {
    clearTestPendingChangeUser();
  });

  it('enqueues, lists, updates and removes for the current user', async () => {
    const item = await enqueuePendingChange({
      resource: 'transactions',
      operation: 'update',
      payload: {
        kind: 'dataProvider',
        method: 'update',
        resource: 'transactions',
        params: { id: 'doc-1', data: { description: 'x' } },
      },
      status: 'pending',
      lastError: null,
    });
    expect(item.userId).toBe(7);
    let listed = await listPendingChangesForUser({
      userId: 7,
      username: 'demo',
    });
    expect(listed).toHaveLength(1);
    await updatePendingChange(item.id, { attemptCount: 2, lastError: 'boom' });
    listed = await listPendingChangesForUser({ userId: 7, username: 'demo' });
    expect(listed[0]?.attemptCount).toBe(2);
    await removePendingChange(item.id);
    listed = await listPendingChangesForUser({ userId: 7, username: 'demo' });
    expect(listed).toHaveLength(0);
  });

  it('scopes list to user id', async () => {
    await enqueuePendingChange({
      resource: 'transactions',
      operation: 'create',
      payload: {
        kind: 'dataProvider',
        method: 'create',
        resource: 'transactions',
        params: { data: { amount: 1 } },
      },
      status: 'pending',
      lastError: null,
      user: { userId: 1, username: 'a' },
    });
    await enqueuePendingChange({
      resource: 'transactions',
      operation: 'create',
      payload: {
        kind: 'dataProvider',
        method: 'create',
        resource: 'transactions',
        params: { data: { amount: 2 } },
      },
      status: 'pending',
      lastError: null,
      user: { userId: 2, username: 'b' },
    });
    const user1 = await listPendingChangesForUser({ userId: 1, username: 'a' });
    expect(user1).toHaveLength(1);
  });

  it('persists across a simulated reload', async () => {
    await enqueuePendingChange({
      resource: 'accounts',
      operation: 'delete',
      payload: {
        kind: 'dataProvider',
        method: 'delete',
        resource: 'accounts',
        params: { id: 'acc-1' },
      },
      status: 'pending',
      lastError: null,
    });
    useLocalStoragePersistenceForTests();
    const listed = await listPendingChangesForUser({
      userId: 7,
      username: 'demo',
    });
    expect(listed).toHaveLength(1);
  });
});
