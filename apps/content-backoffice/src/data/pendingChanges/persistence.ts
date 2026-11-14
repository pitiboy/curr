import { PENDING_CHANGES_STORAGE_VERSION } from './constants';
import type { PendingChangeItem } from './types';

const DB_NAME = 'curr-pending-changes';
const STORE_NAME = 'items';
const LS_KEY = 'curr-pending-changes-v1';

export type PendingChangesPersistence = {
  readAll: () => Promise<PendingChangeItem[]>;
  writeAll: (items: PendingChangeItem[]) => Promise<void>;
  reset: () => Promise<void>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, PENDING_CHANGES_STORAGE_VERSION);
    request.onerror = () =>
      reject(request.error ?? new Error('idb open failed'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

async function idbReadAll(): Promise<PendingChangeItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () =>
      reject(request.error ?? new Error('idb read failed'));
    request.onsuccess = () =>
      resolve((request.result ?? []) as PendingChangeItem[]);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('idb tx failed'));
    };
  });
}

async function idbWriteAll(items: PendingChangeItem[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('idb write failed'));
    };
  });
}

const memoryFallback = new Map<string, string>();

function storageGet(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return memoryFallback.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  memoryFallback.set(key, value);
}

function storageRemove(key: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }
  memoryFallback.delete(key);
}

async function lsReadAll(): Promise<PendingChangeItem[]> {
  const raw = storageGet(LS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingChangeItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function lsWriteAll(items: PendingChangeItem[]): Promise<void> {
  storageSet(LS_KEY, JSON.stringify(items));
}

let persistenceMode: 'idb' | 'localStorage' | null = null;
let activePersistence: PendingChangesPersistence | null = null;

export function useLocalStoragePersistenceForTests(): PendingChangesPersistence {
  persistenceMode = 'localStorage';
  activePersistence = {
    readAll: lsReadAll,
    writeAll: lsWriteAll,
    reset: async () => {
      storageRemove(LS_KEY);
    },
  };
  return activePersistence;
}

export async function getPendingChangesPersistence(): Promise<PendingChangesPersistence> {
  if (activePersistence) return activePersistence;
  if (persistenceMode === 'localStorage') {
    activePersistence = useLocalStoragePersistenceForTests();
    return activePersistence;
  }
  if (idbAvailable()) {
    try {
      await idbReadAll();
      persistenceMode = 'idb';
      activePersistence = {
        readAll: idbReadAll,
        writeAll: idbWriteAll,
        reset: async () => {
          await idbWriteAll([]);
        },
      };
      return activePersistence;
    } catch {
      // fall through to localStorage
    }
  }
  persistenceMode = 'localStorage';
  activePersistence = {
    readAll: lsReadAll,
    writeAll: lsWriteAll,
    reset: async () => {
      storageRemove(LS_KEY);
    },
  };
  return activePersistence;
}

export function resetPendingChangesMemoryFallback(): void {
  memoryFallback.clear();
}

export function resetPendingChangesPersistenceForTests(): void {
  activePersistence = null;
  persistenceMode = null;
  memoryFallback.clear();
}
