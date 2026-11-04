import { encodeStrapiQuery } from '../../data/transactionList';
import type { ContentHttpClient } from '../../data/receiptDraft';
import {
  POOL_TRANSFER_COOP_CREDIT_CODE,
  POOL_TRANSFER_COOP_DEBIT_CODE,
  POULTRY_STOCK_ORGANIZATION_NAME,
  poolTransferRefsFromCatalog,
  type PoolTransferResolvedRefs,
} from './poolTransfer';
import type {
  BulkQuantityHenHouse,
  BulkQuantityResolvedRefs,
  BulkQuantityWorkflowConfig,
} from './types';

type ListResponse = {
  data?: Array<{
    documentId?: string;
    name?: string | null;
    code?: string | null;
  }>;
};

async function fetchOneByFilter(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  resource: string,
  filters: Record<string, unknown>,
) {
  const query = encodeStrapiQuery({
    filters,
    pagination: { page: 1, pageSize: 1 },
  });
  const { json } = (await httpClient(
    `${strapiUrl}/api/${resource}?${query}`,
  )) as { json: ListResponse };
  return json.data?.[0] ?? null;
}

async function fetchHenHouses(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  parentOrganizationName: string,
): Promise<BulkQuantityHenHouse[]> {
  const parent = await fetchOneByFilter(
    httpClient,
    strapiUrl,
    'organizations',
    {
      name: { $eq: parentOrganizationName },
    },
  );
  if (!parent?.documentId) {
    return [];
  }
  const query = encodeStrapiQuery({
    filters: { parent: { documentId: { $eq: parent.documentId } } },
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

export async function loadBulkQuantityCatalog(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  config: BulkQuantityWorkflowConfig,
): Promise<{
  henHouses: BulkQuantityHenHouse[];
  refs: BulkQuantityResolvedRefs | null;
  poolRefs: PoolTransferResolvedRefs | null;
}> {
  const [
    henHouses,
    currency,
    debitAccount,
    creditAccount,
    transactionType,
    poultryStockOrg,
    poolCoopOutDebit,
    poolCoopOutCredit,
  ] = await Promise.all([
    fetchHenHouses(httpClient, strapiUrl, config.parentOrganizationName),
    fetchOneByFilter(httpClient, strapiUrl, 'currency-types', {
      code: { $eq: config.currencyCode },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'accounts', {
      code: { $eq: config.debitAccountCode },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'accounts', {
      code: { $eq: config.creditAccountCode },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'transaction-types', {
      name: { $eq: config.transactionTypeName },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'organizations', {
      name: { $eq: POULTRY_STOCK_ORGANIZATION_NAME },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'accounts', {
      code: { $eq: POOL_TRANSFER_COOP_DEBIT_CODE },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'accounts', {
      code: { $eq: POOL_TRANSFER_COOP_CREDIT_CODE },
    }),
  ]);

  const currencyTypeId = currency?.documentId;
  const debitAccountId = debitAccount?.documentId;
  const creditAccountId = creditAccount?.documentId;
  const transactionTypeId = transactionType?.documentId;

  if (
    !currencyTypeId ||
    !debitAccountId ||
    !creditAccountId ||
    !transactionTypeId
  ) {
    return { henHouses, refs: null, poolRefs: null };
  }

  const refs = {
    currencyTypeId,
    debitAccountId,
    creditAccountId,
    transactionTypeId,
  };

  const parentOrganizationId = poultryStockOrg?.documentId;
  const poolCoopOutDebitId = poolCoopOutDebit?.documentId;
  const poolCoopOutCreditId = poolCoopOutCredit?.documentId;

  const poolRefs =
    parentOrganizationId && poolCoopOutDebitId && poolCoopOutCreditId
      ? poolTransferRefsFromCatalog(
          refs,
          parentOrganizationId,
          poolCoopOutDebitId,
          poolCoopOutCreditId,
        )
      : null;

  return {
    henHouses,
    refs,
    poolRefs,
  };
}
