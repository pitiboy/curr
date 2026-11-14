import { PENDING_CHANGES_BROADCAST_CHANNEL } from './constants';

type Listener = () => void;

const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    channel = new BroadcastChannel(PENDING_CHANGES_BROADCAST_CHANNEL);
    channel.onmessage = () => {
      notifyPendingChangesUpdated();
    };
  }
  return channel;
}

export function subscribePendingChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyPendingChangesUpdated(): void {
  for (const listener of listeners) listener();
}

export function broadcastPendingChangesUpdated(): void {
  notifyPendingChangesUpdated();
  try {
    getChannel()?.postMessage({ type: 'updated' });
  } catch {
    // ignore
  }
}
