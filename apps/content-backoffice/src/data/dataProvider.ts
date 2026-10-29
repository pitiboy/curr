import { strapiDataProvider, strapiHttpClient } from 'ra-strapi';
import type { DataProvider, GetListParams } from 'react-admin';

import { STRAPI_URL } from '../config';
import { attachReceiptToTransaction } from './receiptDraft';
import {
  assembleTransactionList,
  buildTransactionFilters,
  encodeStrapiQuery,
  transactionPopulate,
  type PublicationStatus,
  type StrapiTransaction,
} from './transactionList';
import { loadTransactionRecord } from './transactionRecord';
import { publishTransactionDraft } from './transactionPublish';
import {
  createTransactionDraft,
  updateTransactionDraft,
} from './transactionDraft';
import { withDocumentId } from './withDocumentId';

const httpClient = strapiHttpClient();
const PAGE_SIZE = 100;

type StrapiListResponse = {
  data?: StrapiTransaction[];
  meta?: { pagination?: { pageCount?: number } };
};

async function fetchTransactions(
  status: PublicationStatus,
  strapiFilters: Record<string, unknown>,
): Promise<StrapiTransaction[]> {
  const rows: StrapiTransaction[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const query = encodeStrapiQuery({
      populate: transactionPopulate,
      status,
      pagination: { page, pageSize: PAGE_SIZE, withCount: true },
      ...(Object.keys(strapiFilters).length > 0
        ? { filters: strapiFilters }
        : {}),
    });
    const { json } = (await httpClient(
      `${STRAPI_URL}/api/transactions?${query}`,
    )) as { json: StrapiListResponse };
    rows.push(...(json.data ?? []));
    pageCount = json.meta?.pagination?.pageCount ?? 1;
    page += 1;
  } while (page <= pageCount && page <= 50);

  return rows;
}

const strapiProvider = strapiDataProvider({
  baseURL: STRAPI_URL,
  httpClient,
});

async function getTransactionList(params: GetListParams) {
  const { status, strapiFilters } = buildTransactionFilters(
    params.filter ?? {},
  );
  const [drafts, published] = await Promise.all([
    status === 'published'
      ? Promise.resolve([])
      : fetchTransactions('draft', strapiFilters),
    fetchTransactions('published', strapiFilters),
  ]);
  return assembleTransactionList(drafts, published, params);
}

export const dataProvider = withDocumentId({
  ...strapiProvider,
  getList: (resource, params) =>
    resource === 'transactions'
      ? getTransactionList(params)
      : strapiProvider.getList(resource, params),
  getOne: async (resource, params) => {
    if (resource !== 'transactions') {
      return strapiProvider.getOne(resource, params);
    }
    const row = await loadTransactionRecord(
      httpClient,
      STRAPI_URL,
      String(params.id),
    );
    if (!row) {
      const missing = new Error('Not found') as Error & { status: number };
      missing.status = 404;
      throw missing;
    }
    return { data: row };
  },
  create: (resource, params) =>
    resource === 'transactions'
      ? createTransactionDraft(
          httpClient,
          STRAPI_URL,
          params.data as Record<string, unknown>,
        )
      : strapiProvider.create(resource, params),
} as DataProvider);

export function publishTransaction(documentId: string) {
  return publishTransactionDraft(httpClient, STRAPI_URL, documentId);
}

export function saveTransactionDraft(
  documentId: string,
  data: Record<string, unknown>,
) {
  return updateTransactionDraft(httpClient, STRAPI_URL, documentId, data);
}

export function attachTransactionReceipt(
  documentId: string,
  input: {
    file: File;
    vendor: unknown;
    receiptTypeId: unknown;
    date: unknown;
    amount: unknown;
    description: unknown;
  },
) {
  return attachReceiptToTransaction(httpClient, STRAPI_URL, documentId, input);
}
