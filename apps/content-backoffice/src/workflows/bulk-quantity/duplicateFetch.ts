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

export async function findDuplicateForTransaction(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  input: {
    date: string;
    organizationId: string;
    organizationLabel: string;
    amount: number;
    currencyTypeId: string;
    debitAccountId: string;
    creditAccountId: string;
  },
): Promise<BulkQuantityDuplicate | null> {
  const row: BulkQuantityRow = {
    organizationId: input.organizationId,
    organizationName: input.organizationLabel,
    amount: input.amount,
  };
  const filters = duplicateQueryFilters({
    date: input.date,
    organizationId: input.organizationId,
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
    row,
    existingDocumentId: match.documentId,
    existingAmount: match.amount,
  };
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
  return findDuplicateForTransaction(httpClient, strapiUrl, {
    date: input.date,
    organizationId: input.row.organizationId,
    organizationLabel: input.row.organizationName,
    amount: input.row.amount,
    currencyTypeId: input.currencyTypeId,
    debitAccountId: input.debitAccountId,
    creditAccountId: input.creditAccountId,
  });
}
