/**
 * Strapi-side lookups shared by Convert and Convert preview (no writes):
 * - currency-rate: latest direct `from → to` row with valid_from ≤ source day end,
 *   cached per request (`{from}:{to}:{day}`);
 * - member memberships for the membership-ratio guard (0002 plan §5.2).
 * Everything resolves before Convert writes anything, so a missing rate or an
 * unsupported ratio leaves no rows behind.
 */
import {
  MEMBER_UID,
  isoDay,
  memberAccountFromTransaction,
  pickLatestRate,
  rateCutoff,
  stepsNeedingRate,
  workflowAppliesCurrencyRate,
  type AppliedRate,
  type CurrencyRateRow,
  type RateByCurrency,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert';
import {
  findUnsupportedMembershipRatios,
  type MembershipRatioIssue,
  type MembershipRuleRow,
} from './membership-ratio';

export const CURRENCY_RATE_UID = 'api::currency-rate.currency-rate';

type FindManyApi = {
  findMany: (params?: Record<string, unknown>) => Promise<unknown[]>;
};

export type ConvertContextStrapi = {
  documents: (uid: string) => unknown;
  db: {
    query: (uid: string) => {
      findOne: (params: Record<string, unknown>) => Promise<unknown | null>;
    };
  };
};

type CurrencyRateApiRow = {
  documentId?: string | null;
  rate?: number | string | null;
  valid_from?: string | null;
  from_currency_type?: { documentId?: string | null } | null;
  to_currency_type?: { documentId?: string | null } | null;
};

function toRateRow(row: CurrencyRateApiRow): CurrencyRateRow | null {
  const from = row.from_currency_type?.documentId;
  const to = row.to_currency_type?.documentId;
  if (!from || !to || !row.valid_from || row.rate == null) return null;
  return {
    documentId: row.documentId ?? null,
    rate: row.rate,
    valid_from: row.valid_from,
    fromCurrencyDocumentId: from,
    toCurrencyDocumentId: to,
  };
}

/**
 * Latest direct currency-rate on or before `date` (inclusive UTC day).
 * Returns null when no row exists; same currency → rate 1.
 */
export async function findLatestCurrencyRate(
  strapi: Pick<ConvertContextStrapi, 'documents'>,
  params: {
    fromCurrencyDocumentId: string;
    toCurrencyDocumentId: string;
    date: string;
  },
): Promise<AppliedRate | null> {
  const { fromCurrencyDocumentId, toCurrencyDocumentId, date } = params;
  if (fromCurrencyDocumentId === toCurrencyDocumentId) {
    return pickLatestRate(
      [],
      fromCurrencyDocumentId,
      toCurrencyDocumentId,
      date,
    );
  }
  const api = strapi.documents(CURRENCY_RATE_UID) as FindManyApi;
  const rows = await api.findMany({
    filters: {
      from_currency_type: { documentId: { $eq: fromCurrencyDocumentId } },
      to_currency_type: { documentId: { $eq: toCurrencyDocumentId } },
      valid_from: { $lte: rateCutoff(date) },
    },
    sort: ['valid_from:desc'],
    limit: 1,
    populate: {
      from_currency_type: { fields: ['documentId'] },
      to_currency_type: { fields: ['documentId'] },
    },
  });
  const parsed = (rows ?? [])
    .map((row) => toRateRow(row as CurrencyRateApiRow))
    .filter((row): row is CurrencyRateRow => row !== null);
  // Re-apply the pure rule so the result never depends on DB sort/filter quirks.
  return pickLatestRate(
    parsed,
    fromCurrencyDocumentId,
    toCurrencyDocumentId,
    date,
  );
}

export type RateResolver = (
  fromCurrencyDocumentId: string,
  toCurrencyDocumentId: string,
  date: string,
) => Promise<AppliedRate | null>;

/** Request-scoped cache: one DB lookup per currency pair and day. */
export function createRateResolver(
  strapi: Pick<ConvertContextStrapi, 'documents'>,
): RateResolver {
  const cache = new Map<string, Promise<AppliedRate | null>>();
  return (from, to, date) => {
    const key = `${from}:${to}:${isoDay(date)}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = findLatestCurrencyRate(strapi, {
        fromCurrencyDocumentId: from,
        toCurrencyDocumentId: to,
        date,
      });
      cache.set(key, pending);
    }
    return pending;
  };
}

/**
 * Rates for the template's apply_currency_rate steps. Missing pairs are left
 * out; expandWorkflowSteps then raises 422 CURRENCY_RATE_MISSING.
 */
export async function resolveWorkflowRates(
  resolve: RateResolver,
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
): Promise<RateByCurrency> {
  const map = new Map<string, AppliedRate>();
  const needed = stepsNeedingRate(workflow, transaction);
  if (!needed) return map;
  for (const to of needed.to) {
    const rate = await resolve(needed.from, to, transaction.date);
    if (rate) map.set(to, rate);
  }
  return map;
}

/**
 * Membership-ratio issues for the source member (only when the template has
 * apply_currency_rate steps and the source has a 1101/1001 side).
 */
export async function loadMembershipRatioIssues(
  strapi: Pick<ConvertContextStrapi, 'db'>,
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
): Promise<MembershipRatioIssue[]> {
  if (!workflowAppliesCurrencyRate(workflow)) return [];
  const memberAccount = memberAccountFromTransaction(transaction);
  if (!memberAccount?.documentId) return [];

  const member = (await strapi.db.query(MEMBER_UID).findOne({
    where: {
      $or: [
        { account: { documentId: memberAccount.documentId } },
        { private_account: { documentId: memberAccount.documentId } },
      ],
    },
    populate: {
      memberships: {
        select: ['documentId', 'name', 'valid_from', 'valid_to', 'rules'],
        populate: { membership_type: { select: ['name', 'rules'] } },
      },
    },
  })) as { memberships?: MembershipRuleRow[] | null } | null;

  return findUnsupportedMembershipRatios(
    member?.memberships ?? [],
    transaction.date,
  );
}
