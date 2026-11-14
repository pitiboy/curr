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

export async function executeWithOutbox<T>(
  input: ExecuteWithOutboxInput,
): Promise<T> {
  try {
    return (await input.run()) as T;
  } catch (error) {
    const { retryable, permanent } = classifyWriteFailure(error);
    if (!retryable && !permanent) {
      throw error;
    }
    const status = permanent ? 'failed-permanent' : 'pending';
    if (retryable || permanent) {
      await enqueuePendingChange({
        resource: input.resource,
        operation: input.operation,
        customName: input.customName,
        payload: input.payload,
        status,
        lastError: errorMessage(error),
      });
      if (retryable) {
        notifyPendingChangeEnqueued();
      }
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
