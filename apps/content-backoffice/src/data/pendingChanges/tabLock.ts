import { PENDING_CHANGES_LOCK_NAME } from './constants';

const LS_LOCK_KEY = 'curr-pending-changes-tab-lock';
const LOCK_TTL_MS = 120_000;

type LockHandle = {
  release: () => void;
};

function now(): number {
  return Date.now();
}

function lockStorage(): Storage | Map<string, string> {
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  if (!fallbackLockStorage) {
    fallbackLockStorage = new Map<string, string>();
  }
  return fallbackLockStorage;
}

let fallbackLockStorage: Map<string, string> | null = null;

export function resetPendingChangesTabLockFallback(): void {
  fallbackLockStorage = null;
}

function lockGet(key: string): string | null {
  const storage = lockStorage();
  if (storage instanceof Map) return storage.get(key) ?? null;
  return storage.getItem(key);
}

function lockSet(key: string, value: string): void {
  const storage = lockStorage();
  if (storage instanceof Map) {
    storage.set(key, value);
    return;
  }
  storage.setItem(key, value);
}

function lockRemove(key: string): void {
  const storage = lockStorage();
  if (storage instanceof Map) {
    storage.delete(key);
    return;
  }
  storage.removeItem(key);
}

function readLsLock(): { tabId: string; expiresAt: number } | null {
  try {
    const raw = lockGet(LS_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tabId?: string; expiresAt?: number };
    if (!parsed.tabId || typeof parsed.expiresAt !== 'number') return null;
    return { tabId: parsed.tabId, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function writeLsLock(tabId: string): void {
  lockSet(
    LS_LOCK_KEY,
    JSON.stringify({ tabId, expiresAt: now() + LOCK_TTL_MS }),
  );
}

function clearLsLock(tabId: string): void {
  const current = readLsLock();
  if (current?.tabId === tabId) {
    lockRemove(LS_LOCK_KEY);
  }
}

function tryAcquireLsLock(tabId: string): LockHandle | null {
  const current = readLsLock();
  if (current && current.expiresAt > now() && current.tabId !== tabId) {
    return null;
  }
  writeLsLock(tabId);
  return {
    release: () => clearLsLock(tabId),
  };
}

function tabId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tab-${Math.random().toString(36).slice(2)}`;
}

const SESSION_TAB_ID = tabId();

export async function withPendingChangesSendLock<T>(
  fn: () => Promise<T>,
): Promise<T | null> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    let ran = false;
    let result: T | undefined;
    await navigator.locks.request(
      PENDING_CHANGES_LOCK_NAME,
      { ifAvailable: true },
      async (lock) => {
        if (!lock) return;
        ran = true;
        result = await fn();
      },
    );
    return ran ? (result as T) : null;
  }
  const handle = tryAcquireLsLock(SESSION_TAB_ID);
  if (!handle) return null;
  try {
    let heartbeat: number | undefined;
    if (typeof window !== 'undefined') {
      heartbeat = window.setInterval(() => writeLsLock(SESSION_TAB_ID), 30_000);
    }
    try {
      return await fn();
    } finally {
      if (heartbeat !== undefined && typeof window !== 'undefined') {
        window.clearInterval(heartbeat);
      }
    }
  } finally {
    handle.release();
  }
}

export function __testTryAcquireLsLock(id: string): LockHandle | null {
  return tryAcquireLsLock(id);
}
