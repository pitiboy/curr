export type PendingChangeStatus = 'pending' | 'sending' | 'failed-permanent';

export type PendingDataProviderMethod =
  'create' | 'update' | 'delete' | 'updateMany' | 'deleteMany';

export type PendingCustomOperation = 'convertTransaction';

export type PendingChangePayload =
  | {
      kind: 'dataProvider';
      method: PendingDataProviderMethod;
      resource: string;
      params: Record<string, unknown>;
    }
  | {
      kind: 'custom';
      name: PendingCustomOperation;
      input: Record<string, unknown>;
    };

export type PendingChangeItem = {
  id: string;
  createdAt: string;
  resource: string;
  operation: PendingDataProviderMethod | 'custom';
  customName?: PendingCustomOperation;
  payload: PendingChangePayload;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  status: PendingChangeStatus;
  userId: number;
  username: string;
  summary: string;
  recordKey: string;
};
