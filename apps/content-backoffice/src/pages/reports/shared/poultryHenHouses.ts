import type { ContentHttpClient } from '../../../data/receiptDraft';
import { POULTRY_STOCK_ORGANIZATION_NAME } from '../../../workflows/bulk-quantity/poolTransfer';

import { fetchStrapiList } from './reportTransactionStatus';

type OrgRow = {
  documentId?: string;
  name?: string | null;
};

export type PoultryHenHouseCatalog = {
  ids: Set<string>;
  names: Map<string, string>;
};

/** Tyúktartás child organizations (hen houses / alom). */
export async function loadPoultryHenHouses(
  httpClient: ContentHttpClient,
): Promise<PoultryHenHouseCatalog> {
  const parents = await fetchStrapiList<OrgRow>(
    httpClient,
    '/api/organizations',
    {
      filters: { name: { $eq: POULTRY_STOCK_ORGANIZATION_NAME } },
      fields: ['documentId', 'name'],
    },
  );
  const parentId = parents[0]?.documentId;
  if (!parentId) {
    return { ids: new Set(), names: new Map() };
  }
  const children = await fetchStrapiList<OrgRow>(
    httpClient,
    '/api/organizations',
    {
      filters: { parent: { documentId: { $eq: parentId } } },
      fields: ['documentId', 'name'],
      sort: ['name:asc'],
    },
  );
  const ids = new Set<string>();
  const names = new Map<string, string>();
  for (const row of children) {
    if (!row.documentId) continue;
    ids.add(row.documentId);
    names.set(row.documentId, row.name?.trim() || row.documentId);
  }
  return { ids, names };
}
