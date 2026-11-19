import { encodeStrapiQuery } from '../../data/transactionList';
import type { ContentHttpClient } from '../../data/receiptDraft';
import {
  membershipValidOnDate,
  type CurrencyRateRow,
} from '../../../../../src/egg-production/distribution.ts';
import type {
  BulkQuantityDistributionConfig,
  DistributionMember,
} from './types';

type ListResponse<T> = { data?: T[] };

type OrganizationRow = { documentId?: string; name?: string | null };

type MembershipMemberRow = {
  documentId?: string;
  name?: string | null;
};

type MembershipRow = {
  documentId?: string;
  valid_from?: string | null;
  valid_to?: string | null;
  rules?: unknown;
  members?: MembershipMemberRow[] | null;
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
      members: { fields: ['documentId', 'name'] },
      membership_type: { fields: ['name', 'rules'] },
    },
    sort: ['name:asc'],
    pagination: { page: 1, pageSize: 200 },
  });
  const { json } = (await httpClient(
    `${strapiUrl}/api/memberships?${query}`,
  )) as { json: ListResponse<MembershipRow> };

  const members: DistributionMember[] = [];
  const seenMemberIds = new Set<string>();
  for (const row of json.data ?? []) {
    if (!membershipValidOnDate(row.valid_from, row.valid_to, isoDate)) {
      continue;
    }
    for (const member of row.members ?? []) {
      if (!member?.documentId || !member.name) {
        continue;
      }
      if (seenMemberIds.has(member.documentId)) {
        continue;
      }
      seenMemberIds.add(member.documentId);
      members.push({
        memberId: member.documentId,
        memberName: member.name,
        membershipTypeName: row.membership_type?.name ?? null,
        membershipRules: row.rules,
        membershipTypeRules: row.membership_type?.rules,
      });
    }
  }
  members.sort((a, b) => a.memberName.localeCompare(b.memberName, 'hu'));
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
