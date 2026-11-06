/**
 * Report filter: which publication state of transactions feeds client-side aggregates.
 * Default `preview` keeps previous behaviour (published rows only).
 */

import type { ContentHttpClient } from '../../../data/receiptDraft';
import { STRAPI_URL } from '../../../config';
import { encodeStrapiQuery } from '../../../data/transactionList';

export type ReportTransactionStatusFilter = 'draft' | 'preview' | 'all';

/** Visible default: published/live books — matches former hardcoded `status: 'published'`. */
export const REPORT_TRANSACTION_STATUS_FILTER_DEFAULT: ReportTransactionStatusFilter =
  'preview';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

type ListResponse<T> = {
  data?: T[];
  meta?: { pagination?: { pageCount?: number } };
};

/**
 * Maps UI mode → Strapi Content API query params.
 *
 * Strapi 5 defaults missing `status` to **`published`** (see core `getFetchParams`).
 * So `all` must not omit `status`; we fetch draft + published explicitly.
 *
 * For draft legs we use `publicationFilter: 'never-published'`: only drafts that have
 * no published row (same cohort as draft-only rows in `assembleTransactionList`).
 * Without this, `status=draft` can still include draft snapshots of published docs and
 * duplicate KPIs when merged with published.
 */
export function transactionStatusQuery(
  mode: ReportTransactionStatusFilter,
):
  | { status: 'draft'; publicationFilter: 'never-published' }
  | { status: 'published' }
  | Record<string, never> {
  if (mode === 'draft') {
    return { status: 'draft', publicationFilter: 'never-published' };
  }
  if (mode === 'preview') return { status: 'published' };
  return {};
}

/**
 * Prefer the published row when the same `documentId` exists as draft and published
 * (Strapi returns separate rows per status).
 */
export function mergeReportTransactionsByDocumentId<
  T extends { documentId?: string | null },
>(draftRows: readonly T[], publishedRows: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of draftRows) {
    const id = row.documentId;
    if (id) byId.set(id, row);
  }
  for (const row of publishedRows) {
    const id = row.documentId;
    if (id) byId.set(id, row);
  }
  return [...byId.values()];
}

/** Paginated Strapi list (any collection path). */
export async function fetchStrapiList<T>(
  httpClient: ContentHttpClient,
  path: string,
  queryBase: Record<string, unknown>,
): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const query = encodeStrapiQuery({
      ...queryBase,
      pagination: { page, pageSize: PAGE_SIZE, withCount: true },
    });
    const { json } = (await httpClient(`${STRAPI_URL}${path}?${query}`)) as {
      json: ListResponse<T>;
    };
    rows.push(...(json.data ?? []));
    pageCount = json.meta?.pagination?.pageCount ?? 1;
    page += 1;
  } while (page <= pageCount && page <= MAX_PAGES);
  return rows;
}

/**
 * Loads `/api/transactions` for report aggregation. For `all`, runs two requests
 * (`status=draft` and `status=published`) with identical filters and merges by `documentId`.
 */
export async function loadReportTransactions<T>(
  httpClient: ContentHttpClient,
  mode: ReportTransactionStatusFilter,
  queryBase: Record<string, unknown>,
): Promise<T[]> {
  if (mode !== 'all') {
    const extra = transactionStatusQuery(mode);
    return fetchStrapiList<T>(httpClient, '/api/transactions', {
      ...queryBase,
      ...extra,
    });
  }
  const [draftRows, publishedRows] = await Promise.all([
    fetchStrapiList<T>(httpClient, '/api/transactions', {
      ...queryBase,
      status: 'draft',
      publicationFilter: 'never-published',
    }),
    fetchStrapiList<T>(httpClient, '/api/transactions', {
      ...queryBase,
      status: 'published',
    }),
  ]);
  return mergeReportTransactionsByDocumentId(draftRows, publishedRows);
}
