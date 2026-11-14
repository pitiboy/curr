import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPendingChangesMemoryFallback } from './persistence';
import {
  __testTryAcquireLsLock,
  resetPendingChangesTabLockFallback,
  withPendingChangesSendLock,
} from './tabLock';

describe('pendingChanges tab lock', () => {
  beforeEach(() => {
    resetPendingChangesMemoryFallback();
    resetPendingChangesTabLockFallback();
    vi.restoreAllMocks();
  });

  it('runs only one localStorage lock holder at a time', async () => {
    const lockA = __testTryAcquireLsLock('tab-a');
    expect(lockA).not.toBeNull();
    const lockB = __testTryAcquireLsLock('tab-b');
    expect(lockB).toBeNull();
    lockA?.release();
    const lockC = __testTryAcquireLsLock('tab-b');
    expect(lockC).not.toBeNull();
    lockC?.release();
  });

  it('does not run when Web Lock is unavailable and fallback is held', async () => {
    const originalLocks = navigator.locks;
    Object.defineProperty(navigator, 'locks', {
      value: undefined,
      configurable: true,
    });
    const hold = __testTryAcquireLsLock('holder');
    expect(hold).not.toBeNull();
    let ran = false;
    const result = await withPendingChangesSendLock(async () => {
      ran = true;
      return 1;
    });
    expect(result).toBeNull();
    expect(ran).toBe(false);
    hold?.release();
    Object.defineProperty(navigator, 'locks', {
      value: originalLocks,
      configurable: true,
    });
  });
});
