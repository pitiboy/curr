import { encodeStrapiQuery } from '../../data/transactionList';
import type { ContentHttpClient } from '../../data/receiptDraft';
import {
  mergeDuplicateMatches,
  pickDuplicateCandidate,
  toDuplicateCandidate,
} from './logic';
import type { BulkQuantityDuplicate, BulkQuantityRow } from './types';

const LIST_PAGE_SIZE = 100;
const MAX_LIST_PAGES = 50;
/** Avoid oversized `$in` query strings on large coops. */
const MAX_ORGANIZATION_IDS_PER_REQUEST = 75;

type StrapiListResponse = {
  data?: Array<{
    documentId?: string;
    amount?: string | number | null;
    organization?: string | { documentId?: string | null } | null | undefined;
    currency_type?: string | { documentId?: string | null } | null | undefined;
    debit_account?: string | { documentId?: string | null } | null | undefined;
    credit_account?: string | { documentId?: string | null } | null | undefined;
  }>;
  meta?: { pagination?: { pageCount?: number } };
};

type StrapiDuplicateListRow = NonNullable<StrapiListResponse['data']>[number];

/** One row to match against existing transactions (production, pool leg, or distribution leg). */
export type DuplicateLookupCheck = {
  organizationId: string;
  organizationLabel: string;
  amount: number;
  currencyTypeId: string;
  debitAccountId: string;
  creditAccountId: string;
};

const duplicateListPopulate = {
  organization: true,
  currency_type: true,
  debit_account: true,
  credit_account: true,
};

function relDocumentId(
  rel: string | { documentId?: string | null } | null | undefined,
): string | undefined {
  if (rel == null || rel === '') {
    return undefined;
  }
  if (typeof rel === 'string') {
    return rel;
  }
  return rel.documentId ?? undefined;
}

function duplicateFiltersForOrganizations(input: {
  date: string;
  organizationIds: ReadonlyArray<string>;
  currencyTypeId: string;
  debitAccountId: string;
  creditAccountId: string;
}): Record<string, unknown> | null {
  const ids = input.organizationIds.filter(Boolean);
  if (ids.length === 0) {
    return null;
  }
  return {
    date: { $eq: input.date },
    organization: { documentId: { $in: ids } },
    currency_type: { documentId: { $eq: input.currencyTypeId } },
    debit_account: { documentId: { $eq: input.debitAccountId } },
    credit_account: { documentId: { $eq: input.creditAccountId } },
  };
}

function chunkIds<T>(ids: ReadonlyArray<T>, size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

async function fetchStatusMatchesAllPages(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  status: 'draft' | 'published',
  filters: Record<string, unknown>,
): Promise<NonNullable<StrapiListResponse['data']>> {
  const rows: NonNullable<StrapiListResponse['data']> = [];
  let page = 1;
  let pageCount = 1;
  do {
    const query = encodeStrapiQuery({
      filters,
      status,
      fields: ['documentId', 'amount'],
      populate: duplicateListPopulate,
      pagination: { page, pageSize: LIST_PAGE_SIZE, withCount: true },
    });
    const { json } = (await httpClient(
      `${strapiUrl}/api/transactions?${query}`,
    )) as { json: StrapiListResponse };
    rows.push(...(json.data ?? []));
    pageCount = json.meta?.pagination?.pageCount ?? 1;
    page += 1;
  } while (page <= pageCount && page <= MAX_LIST_PAGES);
  return rows;
}

function matchesAccounts(
  row: StrapiDuplicateListRow,
  currencyTypeId: string,
  debitAccountId: string,
  creditAccountId: string,
): boolean {
  return (
    relDocumentId(row.currency_type) === currencyTypeId &&
    relDocumentId(row.debit_account) === debitAccountId &&
    relDocumentId(row.credit_account) === creditAccountId
  );
}

function resolveDuplicateForCheck(
  check: DuplicateLookupCheck,
  drafts: ReadonlyArray<StrapiDuplicateListRow>,
  published: ReadonlyArray<StrapiDuplicateListRow>,
): BulkQuantityDuplicate | null {
  const row: BulkQuantityRow = {
    organizationId: check.organizationId,
    organizationName: check.organizationLabel,
    amount: check.amount,
  };
  const orgDrafts = drafts.filter(
    (r) => relDocumentId(r.organization) === check.organizationId,
  );
  const orgPublished = published.filter(
    (r) => relDocumentId(r.organization) === check.organizationId,
  );
  const merged = mergeDuplicateMatches(orgDrafts, orgPublished)
    .filter((r) =>
      matchesAccounts(
        r,
        check.currencyTypeId,
        check.debitAccountId,
        check.creditAccountId,
      ),
    )
    .map(toDuplicateCandidate)
    .filter((r): r is NonNullable<typeof r> => r !== null);
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

async function collectDuplicatesForAccountGroup(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  date: string,
  currencyTypeId: string,
  debitAccountId: string,
  creditAccountId: string,
  checks: ReadonlyArray<DuplicateLookupCheck>,
): Promise<BulkQuantityDuplicate[]> {
  const orgIds = [...new Set(checks.map((c) => c.organizationId))];
  const out: BulkQuantityDuplicate[] = [];
  for (const orgChunk of chunkIds(orgIds, MAX_ORGANIZATION_IDS_PER_REQUEST)) {
    const filters = duplicateFiltersForOrganizations({
      date,
      organizationIds: orgChunk,
      currencyTypeId,
      debitAccountId,
      creditAccountId,
    });
    if (!filters) {
      continue;
    }
    const checksThisChunk = checks.filter((c) =>
      orgChunk.includes(c.organizationId),
    );
    if (checksThisChunk.length === 0) {
      continue;
    }
    const [drafts, published] = await Promise.all([
      fetchStatusMatchesAllPages(httpClient, strapiUrl, 'draft', filters),
      fetchStatusMatchesAllPages(httpClient, strapiUrl, 'published', filters),
    ]);
    for (const check of checksThisChunk) {
      const dup = resolveDuplicateForCheck(check, drafts, published);
      if (dup) {
        out.push(dup);
      }
    }
  }
  return out;
}

/**
 * Resolves duplicate transaction rows for many checks with fewer list calls:
 * groups by (currency, debit, credit), uses `$in` on organizations, then draft + published per chunk.
 */
export async function collectBulkQuantityDuplicates(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  date: string,
  checks: ReadonlyArray<DuplicateLookupCheck>,
): Promise<BulkQuantityDuplicate[]> {
  if (checks.length === 0) {
    return [];
  }
  const byAccountKey = new Map<
    string,
    {
      currencyTypeId: string;
      debitAccountId: string;
      creditAccountId: string;
      checks: DuplicateLookupCheck[];
    }
  >();
  for (const check of checks) {
    const key = `${check.currencyTypeId}\0${check.debitAccountId}\0${check.creditAccountId}`;
    let group = byAccountKey.get(key);
    if (!group) {
      group = {
        currencyTypeId: check.currencyTypeId,
        debitAccountId: check.debitAccountId,
        creditAccountId: check.creditAccountId,
        checks: [],
      };
      byAccountKey.set(key, group);
    }
    group.checks.push(check);
  }
  const batches = [...byAccountKey.values()];
  const results = await Promise.all(
    batches.map((group) =>
      collectDuplicatesForAccountGroup(
        httpClient,
        strapiUrl,
        date,
        group.currencyTypeId,
        group.debitAccountId,
        group.creditAccountId,
        group.checks,
      ),
    ),
  );
  return results.flat();
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
  const [duplicate] = await collectBulkQuantityDuplicates(
    httpClient,
    strapiUrl,
    input.date,
    [
      {
        organizationId: input.organizationId,
        organizationLabel: input.organizationLabel,
        amount: input.amount,
        currencyTypeId: input.currencyTypeId,
        debitAccountId: input.debitAccountId,
        creditAccountId: input.creditAccountId,
      },
    ],
  );
  return duplicate ?? null;
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
