import { PENDING_CHANGES_WRITE_TIMEOUT_MS } from './constants';
import { PendingChangeEnqueuedError } from './enqueuedError';
import { classifyWriteFailure, errorMessage } from './errors';
import { notifyPendingChangeEnqueued } from './notify';
import { enqueuePendingChange } from './store';
import type {
  PendingChangePayload,
  PendingChangeItem,
  PendingDataProviderMethod,
} from './types';

export type ExecuteWithOutboxInput = {
  resource: string;
  operation: PendingChangeItem['operation'];
  customName?: PendingChangeItem['customName'];
  payload: PendingChangePayload;
  run: () => Promise<unknown>;
};

export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function networkFailureError(message = 'Failed to fetch'): TypeError {
  return new TypeError(message);
}

function writeTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(networkFailureError('Failed to fetch'));
    }, ms);
  });
}

async function enqueueRetryable(
  input: ExecuteWithOutboxInput,
  error: unknown,
): Promise<void> {
  await enqueuePendingChange({
    resource: input.resource,
    operation: input.operation,
    customName: input.customName,
    payload: input.payload,
    status: 'pending',
    lastError: errorMessage(error),
  });
  notifyPendingChangeEnqueued();
}

async function enqueuePermanent(
  input: ExecuteWithOutboxInput,
  error: unknown,
): Promise<void> {
  await enqueuePendingChange({
    resource: input.resource,
    operation: input.operation,
    customName: input.customName,
    payload: input.payload,
    status: 'failed-permanent',
    lastError: errorMessage(error),
  });
}

export async function executeWithOutbox<T>(
  input: ExecuteWithOutboxInput,
): Promise<T> {
  // DevTools Offline / real offline: do not wait for TCP timeout.
  if (isBrowserOffline()) {
    const offlineError = networkFailureError('Failed to fetch');
    await enqueueRetryable(input, offlineError);
    throw new PendingChangeEnqueuedError(offlineError);
  }

  try {
    return (await Promise.race([
      input.run(),
      writeTimeout(PENDING_CHANGES_WRITE_TIMEOUT_MS),
    ])) as T;
  } catch (error) {
    if (error instanceof PendingChangeEnqueuedError) {
      throw error;
    }
    const { retryable, permanent } = classifyWriteFailure(error);
    if (retryable) {
      await enqueueRetryable(input, error);
      throw new PendingChangeEnqueuedError(error);
    }
    if (permanent) {
      await enqueuePermanent(input, error);
    }
    throw error;
  }
}

function cloneParams(params: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
}

export function dataProviderPayload(
  method: PendingDataProviderMethod,
  resource: string,
  params: Record<string, unknown>,
): PendingChangePayload {
  return {
    kind: 'dataProvider',
    method,
    resource,
    params: cloneParams(params),
  };
}
