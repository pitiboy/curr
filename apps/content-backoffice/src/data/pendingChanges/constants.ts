export const PENDING_CHANGES_RETRY_INTERVAL_MS = 60_000;

/** Fail-fast when the browser hangs on a dead connection (navigator.onLine can lie). */
export const PENDING_CHANGES_WRITE_TIMEOUT_MS = 8_000;

export const PENDING_CHANGES_FEATURE_ID = 'pending-changes';

export const PENDING_CHANGES_LOCK_NAME = 'curr-pending-changes-send';

export const PENDING_CHANGES_BROADCAST_CHANNEL = 'curr-pending-changes';

export const PENDING_CHANGES_STORAGE_VERSION = 1;
