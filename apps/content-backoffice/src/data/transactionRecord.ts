import type { ContentHttpClient } from './receiptDraft';
import {
  encodeStrapiQuery,
  preferTransaction,
  transactionPopulate,
  type PublicationStatus,
  type StrapiTransaction,
  type TransactionRow,
} from './transactionList';

/** Draft and published versions of one document. The published row wins. */
export async function loadTransactionRecord(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  documentId: string,
): Promise<TransactionRow | null> {
  const [draft, published] = await Promise.all([
    fetchTransaction(httpClient, strapiUrl, documentId, 'draft'),
    fetchTransaction(httpClient, strapiUrl, documentId, 'published'),
  ]);
  return preferTransaction(draft, published);
}

async function fetchTransaction(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  documentId: string,
  status: PublicationStatus,
): Promise<StrapiTransaction | null> {
  const query = encodeStrapiQuery({
    populate: transactionPopulate,
    status,
  });
  const url = `${strapiUrl}/api/transactions/${encodeURIComponent(documentId)}?${query}`;
  try {
    const { json } = await httpClient(url);
    const data =
      json && typeof json === 'object' && 'data' in json
        ? (json as { data?: unknown }).data
        : null;
    if (!data || typeof data !== 'object') return null;
    return data as StrapiTransaction;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 404
  );
}
