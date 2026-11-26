import { encodeStrapiQuery } from '../../data/transactionList';
import type { ContentHttpClient } from '../../data/receiptDraft';
import type { BulkQuantityHenHouse } from './types';

type ListResponse = {
  data?: Array<{
    documentId?: string;
    name?: string | null;
  }>;
};

/**
 * Hen houses = direct children of the parent org (one quantity input each).
 * Accounts, currencies and templates are resolved by the backend endpoint.
 */
export async function loadHenHouses(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  parentOrganizationName: string,
): Promise<BulkQuantityHenHouse[]> {
  const parentQuery = encodeStrapiQuery({
    filters: { name: { $eq: parentOrganizationName } },
    pagination: { page: 1, pageSize: 1 },
  });
  const { json: parentJson } = (await httpClient(
    `${strapiUrl}/api/organizations?${parentQuery}`,
  )) as { json: ListResponse };
  const parentId = parentJson.data?.[0]?.documentId;
  if (!parentId) {
    return [];
  }
  const query = encodeStrapiQuery({
    filters: { parent: { documentId: { $eq: parentId } } },
    sort: ['name:asc'],
    pagination: { page: 1, pageSize: 100 },
  });
  const { json } = (await httpClient(
    `${strapiUrl}/api/organizations?${query}`,
  )) as { json: ListResponse };
  return (json.data ?? [])
    .map((row) => ({
      documentId: row.documentId ?? '',
      name: typeof row.name === 'string' ? row.name : '',
    }))
    .filter((row) => row.documentId && row.name);
}
