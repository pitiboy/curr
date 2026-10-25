import { encodeStrapiQuery } from '../../data/transactionList';
import type { ContentHttpClient } from '../../data/receiptDraft';
import { EGG_SALE_CURRENCY } from '../../config';
import type { CurrencyRateRow } from './distributionLogic';
import { membershipValidOnDate } from './distributionLogic';
import type {
  BulkQuantityDistributionConfig,
  DistributionMember,
  DistributionResolvedRefs,
} from './types';

type ListResponse<T> = { data?: T[] };

type OrganizationRow = { documentId?: string; name?: string | null };

type MembershipRow = {
  documentId?: string;
  valid_from?: string | null;
  valid_to?: string | null;
  rules?: unknown;
  member?: {
    documentId?: string;
    name?: string | null;
    account?: { documentId?: string; code?: string | null } | null;
    private_account?: { documentId?: string; code?: string | null } | null;
  } | null;
  membership_type?: { name?: string | null; rules?: unknown } | null;
};

type CurrencyRateApiRow = {
  documentId?: string;
  rate?: string | number | null;
  valid_from?: string | null;
  from_currency_type?: { code?: string | null } | null;
  to_currency_type?: { code?: string | null } | null;
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
  )) as { json: ListResponse<OrganizationRow> };
  return json.data?.[0] ?? null;
}

export async function loadDistributionMembers(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  config: BulkQuantityDistributionConfig,
  isoDate: string,
): Promise<DistributionMember[]> {
  const org = await fetchOneByFilter(httpClient, strapiUrl, 'organizations', {
    name: { $eq: config.memberOrganizationName },
  });
  if (!org?.documentId) {
    return [];
  }
  const query = encodeStrapiQuery({
    filters: {
      organization: { documentId: { $eq: org.documentId } },
    },
    populate: {
      member: {
        populate: {
          account: { fields: ['documentId', 'code'] },
          private_account: { fields: ['documentId', 'code'] },
        },
      },
      membership_type: { fields: ['name', 'rules'] },
    },
    sort: ['member.name:asc'],
    pagination: { page: 1, pageSize: 200 },
  });
  const { json } = (await httpClient(
    `${strapiUrl}/api/memberships?${query}`,
  )) as { json: ListResponse<MembershipRow> };

  const members: DistributionMember[] = [];
  for (const row of json.data ?? []) {
    const member = row.member;
    if (!member?.documentId || !member.name) {
      continue;
    }
    if (!membershipValidOnDate(row.valid_from, row.valid_to, isoDate)) {
      continue;
    }
    members.push({
      memberId: member.documentId,
      memberName: member.name,
      membershipTypeName: row.membership_type?.name ?? null,
      membershipRules: row.rules,
      membershipTypeRules: row.membership_type?.rules,
      account: member.account ?? null,
      private_account: member.private_account ?? null,
    });
  }
  return members;
}

export async function loadCurrencyRates(
  httpClient: ContentHttpClient,
  strapiUrl: string,
): Promise<CurrencyRateRow[]> {
  const query = encodeStrapiQuery({
    populate: {
      from_currency_type: { fields: ['code'] },
      to_currency_type: { fields: ['code'] },
    },
    pagination: { page: 1, pageSize: 500 },
    sort: ['valid_from:desc'],
  });
  const { json } = (await httpClient(
    `${strapiUrl}/api/currency-rates?${query}`,
  )) as { json: ListResponse<CurrencyRateApiRow> };
  return (json.data ?? [])
    .map((row) => {
      const rate = Number(row.rate);
      const fromCurrencyCode = row.from_currency_type?.code;
      const toCurrencyCode = row.to_currency_type?.code;
      const validFrom = row.valid_from;
      if (
        !Number.isFinite(rate) ||
        typeof fromCurrencyCode !== 'string' ||
        typeof toCurrencyCode !== 'string' ||
        !validFrom
      ) {
        return null;
      }
      return {
        rate,
        validFrom,
        fromCurrencyCode,
        toCurrencyCode,
      };
    })
    .filter((row): row is CurrencyRateRow => row !== null);
}

export async function loadDistributionRefs(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  config: BulkQuantityDistributionConfig,
  productionCurrencyCode: string,
): Promise<DistributionResolvedRefs | null> {
  const [
    bookingOrg,
    eggCurrency,
    saleCurrency,
    inventoryAccount,
    saleCashAccount,
    revenueAccount,
    internalType,
    saleEggType,
    saleCashPaymentType,
    saleRevenueType,
  ] = await Promise.all([
    fetchOneByFilter(httpClient, strapiUrl, 'organizations', {
      name: { $eq: config.bookingOrganizationName },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'currency-types', {
      code: { $eq: productionCurrencyCode },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'currency-types', {
      code: { $eq: EGG_SALE_CURRENCY },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'accounts', {
      code: { $eq: config.inventoryAccountCode },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'accounts', {
      code: { $eq: config.saleCashAccountCode },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'accounts', {
      code: { $eq: config.revenueCreditAccountCode },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'transaction-types', {
      name: { $eq: config.internalTransactionTypeName },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'transaction-types', {
      name: { $eq: config.saleEggTransactionTypeName },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'transaction-types', {
      name: { $eq: config.saleCashPaymentTransactionTypeName },
    }),
    fetchOneByFilter(httpClient, strapiUrl, 'transaction-types', {
      name: { $eq: config.saleRevenueTransactionTypeName },
    }),
  ]);

  const bookingOrganizationId = bookingOrg?.documentId;
  const eggCurrencyTypeId = eggCurrency?.documentId;
  const saleCurrencyTypeId = saleCurrency?.documentId;
  const inventoryAccountId = inventoryAccount?.documentId;
  const saleCashAccountId = saleCashAccount?.documentId;
  const revenueAccountId = revenueAccount?.documentId;
  const internalTransactionTypeId = internalType?.documentId;
  const saleEggTransactionTypeId = saleEggType?.documentId;
  const saleCashPaymentTransactionTypeId = saleCashPaymentType?.documentId;
  const saleRevenueTransactionTypeId = saleRevenueType?.documentId;

  if (
    !bookingOrganizationId ||
    !eggCurrencyTypeId ||
    !saleCurrencyTypeId ||
    !inventoryAccountId ||
    !saleCashAccountId ||
    !revenueAccountId ||
    !internalTransactionTypeId ||
    !saleEggTransactionTypeId ||
    !saleCashPaymentTransactionTypeId ||
    !saleRevenueTransactionTypeId
  ) {
    return null;
  }

  return {
    bookingOrganizationId,
    eggCurrencyTypeId,
    saleCurrencyTypeId,
    inventoryAccountId,
    saleCashAccountId,
    revenueAccountId,
    internalTransactionTypeId,
    saleEggTransactionTypeId,
    saleCashPaymentTransactionTypeId,
    saleRevenueTransactionTypeId,
  };
}
