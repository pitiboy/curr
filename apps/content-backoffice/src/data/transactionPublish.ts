import type { ContentHttpClient } from './receiptDraft';

/** Document Service publish. An update with status=published is rejected. */
export function transactionPublishUrl(
  strapiUrl: string,
  documentId: string,
): string {
  return `${strapiUrl}/api/transactions/${encodeURIComponent(documentId)}/actions/publish`;
}

export async function publishTransactionDraft(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  documentId: string,
): Promise<void> {
  await httpClient(transactionPublishUrl(strapiUrl, documentId), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** Strapi wraps the guard message under `error.message`. */
export function strapiErrorMessage(error: unknown): string {
  const fromBody = messageFromBody(errorBody(error));
  if (fromBody) return fromBody;
  if (error instanceof Error && error.message.trim())
    return error.message.trim();
  return '';
}

export function isSamePersonPublishError(message: string): boolean {
  return message.includes('entered the document');
}

function errorBody(error: unknown): unknown {
  if (!error || typeof error !== 'object' || !('body' in error))
    return undefined;
  return (error as { body?: unknown }).body;
}

function messageFromBody(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const nested = (body as { error?: { message?: unknown } }).error;
  if (nested && typeof nested.message === 'string' && nested.message.trim()) {
    return nested.message.trim();
  }
  const message = (body as { message?: unknown }).message;
  return typeof message === 'string' ? message.trim() : '';
}
