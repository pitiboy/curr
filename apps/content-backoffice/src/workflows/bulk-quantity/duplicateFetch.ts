import { encodeStrapiQuery } from '../../data/transactionList';
import type { ContentHttpClient } from '../../data/receiptDraft';
import {
  duplicateQueryFilters,
  mergeDuplicateMatches,
  pickDuplicateCandidate,
  toDuplicateCandidate,
} from './logic';
import type { BulkQuantityDuplicate, BulkQuantityRow } from './types';

type StrapiListResponse = {
  data?: Array<{
    documentId?: string;
    amount?: string | number | null;
  }>;
};

async function fetchStatusMatches(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  status: 'draft' | 'published',
  filters: Record<string, unknown>,
) {
  const query = encodeStrapiQuery({
    filters,
    status,
    pagination: { page: 1, pageSize: 5 },
  });
  const { json } = (await httpClient(
    `${strapiUrl}/api/transactions?${query}`,
  )) as { json: StrapiListResponse };
  return json.data ?? [];
}

export async function findDuplicateForRow(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  input: {
    date: string;
    row: BulkQuantityRow;
    currencyTypeId: string;
    debitAccountId: string;
    creditAccountId: string;
  },
): Promise<BulkQuantityDuplicate | null> {
  const filters = duplicateQueryFilters({
    date: input.date,
    organizationId: input.row.organizationId,
    currencyTypeId: input.currencyTypeId,
    debitAccountId: input.debitAccountId,
    creditAccountId: input.creditAccountId,
  });
  const [drafts, published] = await Promise.all([
    fetchStatusMatches(httpClient, strapiUrl, 'draft', filters),
    fetchStatusMatches(httpClient, strapiUrl, 'published', filters),
  ]);
  const merged = mergeDuplicateMatches(drafts, published)
    .map(toDuplicateCandidate)
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const match = pickDuplicateCandidate(merged);
  if (!match) {
    return null;
  }
  return {
    row: input.row,
    existingDocumentId: match.documentId,
    existingAmount: match.amount,
  };
}
