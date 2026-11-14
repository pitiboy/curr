import { buildRecordKey } from './recordKey';
import { getPendingChangesPersistence } from './persistence';
import { buildPayloadSummary } from './summary';
import { broadcastPendingChangesUpdated } from './storeEvents';
import type {
  PendingChangeItem,
  PendingChangePayload,
  PendingChangeStatus,
} from './types';
import { getPendingChangeUser, type PendingChangeUser } from './currentUser';

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readItems(): Promise<PendingChangeItem[]> {
  const persistence = await getPendingChangesPersistence();
  return persistence.readAll();
}

async function writeItems(items: PendingChangeItem[]): Promise<void> {
  const persistence = await getPendingChangesPersistence();
  await persistence.writeAll(items);
  broadcastPendingChangesUpdated();
}

export async function listPendingChangesForUser(
  user: PendingChangeUser,
): Promise<PendingChangeItem[]> {
  const items = await readItems();
  return items
    .filter((item) => item.userId === user.userId)
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
}

export async function listPendingChangesForCurrentUser(): Promise<
  PendingChangeItem[]
> {
  const user = getPendingChangeUser();
  if (!user) return [];
  return listPendingChangesForUser(user);
}

export type EnqueuePendingChangeInput = {
  resource: string;
  operation: PendingChangeItem['operation'];
  customName?: PendingChangeItem['customName'];
  payload: PendingChangePayload;
  status: PendingChangeStatus;
  lastError: string | null;
  user?: PendingChangeUser | null;
};

export async function enqueuePendingChange(
  input: EnqueuePendingChangeInput,
): Promise<PendingChangeItem> {
  const user = input.user ?? getPendingChangeUser();
  if (!user) {
    throw new Error('Cannot enqueue pending change without logged-in user');
  }
  const id = newId();
  const payload = { ...input.payload };
  if (payload.kind === 'dataProvider' && payload.method === 'create') {
    payload.params = {
      ...payload.params,
      pendingClientId: id,
    };
  }
  const recordKey = buildRecordKey(payload, id);
  const item: PendingChangeItem = {
    id,
    createdAt: new Date().toISOString(),
    resource: input.resource,
    operation: input.operation,
    customName: input.customName,
    payload,
    attemptCount: 0,
    lastAttemptAt: null,
    lastError: input.lastError,
    status: input.status,
    userId: user.userId,
    username: user.username,
    summary: buildPayloadSummary(payload),
    recordKey,
  };
  const items = await readItems();
  items.push(item);
  await writeItems(items);
  return item;
}

export async function removePendingChange(id: string): Promise<void> {
  const items = await readItems();
  await writeItems(items.filter((item) => item.id !== id));
}

export async function updatePendingChange(
  id: string,
  patch: Partial<
    Pick<
      PendingChangeItem,
      'status' | 'attemptCount' | 'lastAttemptAt' | 'lastError'
    >
  >,
): Promise<PendingChangeItem | null> {
  const items = await readItems();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = { ...items[index]!, ...patch };
  items[index] = next;
  await writeItems(items);
  return next;
}

export async function countActivePendingForUser(
  user: PendingChangeUser,
): Promise<number> {
  const items = await listPendingChangesForUser(user);
  return items.filter(
    (item) => item.status === 'pending' || item.status === 'sending',
  ).length;
}
