import type { ContentHttpClient } from './receiptDraft';

/** Controller-only: guarded `DELETE` (expanded / storno / not-expanded rows). */
export function transactionDeleteUrl(
  strapiUrl: string,
  documentId: string,
): string {
  return `${strapiUrl}/api/transactions/${encodeURIComponent(documentId)}`;
}

/** Controller-only: delete every expanded + storno child of an `original`. */
export function transactionPurgeExpansionUrl(
  strapiUrl: string,
  originalDocumentId: string,
): string {
  return `${strapiUrl}/api/transactions/${encodeURIComponent(originalDocumentId)}/actions/purge-expansion`;
}

export async function deleteTransactionRow(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  documentId: string,
): Promise<void> {
  await httpClient(transactionDeleteUrl(strapiUrl, documentId), {
    method: 'DELETE',
  });
}

export async function purgeTransactionExpansion(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  originalDocumentId: string,
): Promise<void> {
  await httpClient(
    transactionPurgeExpansionUrl(strapiUrl, originalDocumentId),
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}
