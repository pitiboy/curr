import type { DataProvider } from 'react-admin';

import { convertTransaction as postConvertTransaction } from '../transactionWorkflow';
import { createTransactionDraft } from '../transactionDraft';
import type { ContentHttpClient } from '../receiptDraft';
import { STRAPI_URL } from '../../config';

import type { PendingChangeItem } from './types';

type ReplayDeps = {
  dataProvider: DataProvider;
  httpClient: ContentHttpClient;
  strapiUrl?: string;
};

export async function replayPendingChange(
  item: PendingChangeItem,
  deps: ReplayDeps,
): Promise<unknown> {
  const payload = item.payload;
  const provider = deps.dataProvider;
  const httpClient = deps.httpClient;
  const strapiUrl = deps.strapiUrl ?? STRAPI_URL;

  if (payload.kind === 'dataProvider') {
    const params = { ...payload.params };
    delete params.pendingClientId;
    switch (payload.method) {
      case 'create':
        return provider.create(payload.resource, params as never);
      case 'update':
        return provider.update(payload.resource, params as never);
      case 'delete':
        return provider.delete(payload.resource, params as never);
      case 'updateMany':
        return provider.updateMany!(payload.resource, params as never);
      case 'deleteMany':
        return provider.deleteMany!(payload.resource, params as never);
      default:
        throw new Error(`Unsupported pending method: ${payload.method}`);
    }
  }
  if (payload.name === 'convertTransaction') {
    const input = payload.input as {
      transactionDocumentId: string;
      workflowDocumentId: string;
    };
    return postConvertTransaction(httpClient, strapiUrl, input);
  }
  if (payload.name === 'createAndConvert') {
    const input = payload.input as {
      data: Record<string, unknown>;
      workflowDocumentId: string;
    };
    const created = await createTransactionDraft(
      httpClient,
      strapiUrl,
      input.data,
    );
    const documentId =
      typeof created.data.documentId === 'string'
        ? created.data.documentId
        : '';
    if (!documentId) {
      throw new Error('Missing documentId after create');
    }
    return postConvertTransaction(httpClient, strapiUrl, {
      transactionDocumentId: documentId,
      workflowDocumentId: input.workflowDocumentId,
    });
  }
  throw new Error('Unsupported pending custom operation');
}

export function invalidationResource(item: PendingChangeItem): string {
  if (item.payload.kind === 'dataProvider') {
    return item.payload.resource;
  }
  return 'transactions';
}
