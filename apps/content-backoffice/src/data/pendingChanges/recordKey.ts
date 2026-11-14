import type { PendingChangeItem, PendingChangePayload } from './types';

export function buildRecordKey(
  payload: PendingChangePayload,
  fallbackId: string,
): string {
  if (payload.kind === 'dataProvider') {
    if (payload.method === 'create') {
      const clientId =
        typeof payload.params.pendingClientId === 'string'
          ? payload.params.pendingClientId
          : fallbackId;
      return `${payload.resource}:create:${clientId}`;
    }
    if (payload.method === 'updateMany' || payload.method === 'deleteMany') {
      const ids = Array.isArray(payload.params.ids)
        ? payload.params.ids.join(',')
        : fallbackId;
      return `${payload.resource}:${payload.method}:${ids}`;
    }
    const id = payload.params.id;
    return `${payload.resource}:${typeof id === 'string' || typeof id === 'number' ? String(id) : fallbackId}`;
  }
  if (payload.name === 'convertTransaction') {
    const txId = payload.input.transactionDocumentId;
    return `transactions:${typeof txId === 'string' ? txId : fallbackId}:convert`;
  }
  if (payload.name === 'createAndConvert') {
    return `transactions:createAndConvert:${fallbackId}`;
  }
  return fallbackId;
}

export function sortFifoForRetry(
  items: PendingChangeItem[],
): PendingChangeItem[] {
  const sorted = [...items].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const seen = new Set<string>();
  const ready: PendingChangeItem[] = [];
  for (const item of sorted) {
    if (item.status === 'failed-permanent') continue;
    if (seen.has(item.recordKey)) continue;
    seen.add(item.recordKey);
    ready.push(item);
  }
  return ready;
}

export function isBlockedByEarlierPending(
  item: PendingChangeItem,
  all: PendingChangeItem[],
): boolean {
  const sameRecord = all
    .filter((row) => row.recordKey === item.recordKey)
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  const firstPending = sameRecord.find((row) => row.status === 'pending');
  return firstPending !== undefined && firstPending.id !== item.id;
}
