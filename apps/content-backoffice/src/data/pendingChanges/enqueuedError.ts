import { errorMessage } from './errors';

/** Thrown after a write was saved to the outbox (retryable offline / network failure). */
export class PendingChangeEnqueuedError extends Error {
  readonly pendingChangeEnqueued = true as const;
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(errorMessage(cause) || 'Failed to fetch');
    this.name = 'PendingChangeEnqueuedError';
    this.cause = cause;
  }
}

export function isPendingChangeEnqueuedError(
  error: unknown,
): error is PendingChangeEnqueuedError {
  if (error instanceof PendingChangeEnqueuedError) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { pendingChangeEnqueued?: unknown }).pendingChangeEnqueued ===
      true
  );
}
