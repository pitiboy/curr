import type { DataProvider } from 'react-admin';

import type { ContentHttpClient } from '../receiptDraft';
import { PENDING_CHANGES_RETRY_INTERVAL_MS } from './constants';
import { classifyWriteFailure, errorMessage } from './errors';
import { isBlockedByEarlierPending, sortFifoForRetry } from './recordKey';
import { invalidationResource, replayPendingChange } from './replay';
import {
  listPendingChangesForCurrentUser,
  removePendingChange,
  updatePendingChange,
} from './store';
import { withPendingChangesSendLock } from './tabLock';
import type { PendingChangeItem } from './types';
import { getPendingChangeUser } from './currentUser';

export type PendingChangesInvalidate = (resource: string) => void;

export type PendingChangesRetryRunner = {
  runOnce: () => Promise<void>;
  start: () => void;
  stop: () => void;
};

export function createPendingChangesRetryRunner(
  dataProvider: DataProvider,
  invalidate: PendingChangesInvalidate,
  options?: {
    innerProvider?: DataProvider;
    intervalMs?: number;
    httpClient?: ContentHttpClient;
  },
): PendingChangesRetryRunner {
  const replayProvider = options?.innerProvider ?? dataProvider;
  const replayHttpClient =
    options?.httpClient ??
    (async () => {
      throw new Error(
        'pending-changes retry requires httpClient for custom operations',
      );
    });
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  const processItem = async (
    item: PendingChangeItem,
    all: PendingChangeItem[],
  ) => {
    if (item.status !== 'pending') return;
    if (isBlockedByEarlierPending(item, all)) return;

    await updatePendingChange(item.id, { status: 'sending' });
    try {
      await replayPendingChange(item, {
        dataProvider: replayProvider,
        httpClient: replayHttpClient,
      });
      await removePendingChange(item.id);
      invalidate(invalidationResource(item));
    } catch (error) {
      const { permanent } = classifyWriteFailure(error);
      await updatePendingChange(item.id, {
        status: permanent ? 'failed-permanent' : 'pending',
        attemptCount: item.attemptCount + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: errorMessage(error),
      });
    }
  };

  const runOnce = async () => {
    const user = getPendingChangeUser();
    if (!user) return;
    const locked = await withPendingChangesSendLock(async () => {
      if (running) return;
      running = true;
      try {
        const all = await listPendingChangesForCurrentUser();
        const queue = sortFifoForRetry(all);
        for (const item of queue) {
          await processItem(item, all);
        }
      } finally {
        running = false;
      }
    });
    void locked;
  };

  const start = () => {
    if (timer) return;
    void runOnce();
    timer = setInterval(() => {
      void runOnce();
    }, options?.intervalMs ?? PENDING_CHANGES_RETRY_INTERVAL_MS);
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  return { runOnce, start, stop };
}

export async function retrySinglePendingChange(
  item: PendingChangeItem,
  dataProvider: DataProvider,
  invalidate: PendingChangesInvalidate,
  innerProvider?: DataProvider,
  httpClient?: ContentHttpClient,
): Promise<void> {
  if (item.status === 'failed-permanent') {
    throw new Error('failed-permanent');
  }
  const all = await listPendingChangesForCurrentUser();
  if (isBlockedByEarlierPending(item, all)) {
    throw new Error('blocked-by-earlier');
  }
  const done = await withPendingChangesSendLock(async () => {
    await updatePendingChange(item.id, { status: 'sending' });
    try {
      await replayPendingChange(item, {
        dataProvider: innerProvider ?? dataProvider,
        httpClient:
          httpClient ??
          (async () => {
            throw new Error(
              'pending-changes retry requires httpClient for custom operations',
            );
          }),
      });
      await removePendingChange(item.id);
      invalidate(invalidationResource(item));
      return true;
    } catch (error) {
      const { permanent } = classifyWriteFailure(error);
      await updatePendingChange(item.id, {
        status: permanent ? 'failed-permanent' : 'pending',
        attemptCount: item.attemptCount + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: errorMessage(error),
      });
      throw error;
    }
  });
  if (!done) {
    throw new Error('lock-unavailable');
  }
}
