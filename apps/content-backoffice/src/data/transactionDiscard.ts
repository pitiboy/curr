import type { ContentHttpClient } from './receiptDraft';

export function transactionDiscardDraftUrl(
  strapiUrl: string,
  documentId: string,
): string {
  return `${strapiUrl}/api/transactions/${encodeURIComponent(documentId)}/actions/discard-draft`;
}

export async function discardTransactionDraft(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  documentId: string,
): Promise<void> {
  await httpClient(transactionDiscardDraftUrl(strapiUrl, documentId), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
