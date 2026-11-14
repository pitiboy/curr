type NotifyFn = (
  message: string,
  options?: { type?: 'warning' | 'info' | 'error' },
) => void;

let notifyFn: NotifyFn | null = null;

export function setPendingChangesNotify(fn: NotifyFn | null): void {
  notifyFn = fn;
}

export function notifyPendingChangeEnqueued(): void {
  notifyFn?.('app.pending_changes.enqueued', { type: 'warning' });
}
