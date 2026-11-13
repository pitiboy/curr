/**
 * Strapi-side lookups shared by Convert and Convert preview (no writes):
 * - currency-rate: latest `from → to` row with valid_from ≤ source day end,
 *   cached per request (`{from}:{to}:{day}`); KOR pairs may invert `to → from`;
 * - member ratio for the source currency (`rules[code]`, 0002 plan §5.2).
 * Everything resolves before Convert writes anything, so a missing rate or an
 * ambiguous ratio leaves no rows behind.
 */
import {
  MEMBER_UID,
  currencyPairInvolvesKor,
  invertAppliedRate,
  isoDay,
  memberAccountFromTransaction,
  pickDirectLatestRate,
  pickLatestRate,
  rateCutoff,
  stepsNeedingRate,
  type AppliedRate,
  type CurrencyRateRow,
  type MemberRatio,
  type PickLatestRateOptions,
  type RateByCurrency,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert';
import { resolveMemberRatio, type MembershipRuleRow } from './membership-ratio';

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

async function queryLatestRateRows(
  strapi: Pick<ConvertContextStrapi, 'documents'>,
  fromCurrencyDocumentId: string,
  toCurrencyDocumentId: string,
  date: string,
): Promise<CurrencyRateRow[]> {
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
  return (rows ?? [])
    .map((row) => toRateRow(row as CurrencyRateApiRow))
    .filter((row): row is CurrencyRateRow => row !== null);
}

/**
 * Latest currency-rate on or before `date` (inclusive UTC day).
 * Direct `from → to` wins. When codes show a KOR pair and the direct row is
 * missing, uses `1 / rate(to → from)`. Same currency → rate 1.
 */
export async function findLatestCurrencyRate(
  strapi: Pick<ConvertContextStrapi, 'documents'>,
  params: {
    fromCurrencyDocumentId: string;
    toCurrencyDocumentId: string;
    date: string;
    fromCode?: string | null;
    toCode?: string | null;
  },
): Promise<AppliedRate | null> {
  const {
    fromCurrencyDocumentId,
    toCurrencyDocumentId,
    date,
    fromCode,
    toCode,
  } = params;
  if (fromCurrencyDocumentId === toCurrencyDocumentId) {
    return pickLatestRate(
      [],
      fromCurrencyDocumentId,
      toCurrencyDocumentId,
      date,
    );
  }
  const directRows = await queryLatestRateRows(
    strapi,
    fromCurrencyDocumentId,
    toCurrencyDocumentId,
    date,
  );
  const direct = pickDirectLatestRate(
    directRows,
    fromCurrencyDocumentId,
    toCurrencyDocumentId,
    date,
  );
  if (direct) return direct;
  if (!currencyPairInvolvesKor(fromCode, toCode)) return null;
  const inverseRows = await queryLatestRateRows(
    strapi,
    toCurrencyDocumentId,
    fromCurrencyDocumentId,
    date,
  );
  const inverse = pickDirectLatestRate(
    inverseRows,
    toCurrencyDocumentId,
    fromCurrencyDocumentId,
    date,
  );
  if (!inverse) return null;
  return invertAppliedRate(
    inverse,
    fromCurrencyDocumentId,
    toCurrencyDocumentId,
  );
}

export type RateResolver = (
  fromCurrencyDocumentId: string,
  toCurrencyDocumentId: string,
  date: string,
  codes?: PickLatestRateOptions,
) => Promise<AppliedRate | null>;

/** Request-scoped cache: one DB lookup per currency pair and day. */
export function createRateResolver(
  strapi: Pick<ConvertContextStrapi, 'documents'>,
): RateResolver {
  const cache = new Map<string, Promise<AppliedRate | null>>();
  return (from, to, date, codes) => {
    const key = `${from}:${to}:${isoDay(date)}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = findLatestCurrencyRate(strapi, {
        fromCurrencyDocumentId: from,
        toCurrencyDocumentId: to,
        date,
        fromCode: codes?.fromCode,
        toCode: codes?.toCode,
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
  const fromCode = transaction.currency_type?.code ?? null;
  for (const to of needed.to) {
    const step = (workflow.step ?? []).find(
      (candidate) =>
        candidate?.apply_currency_rate === true &&
        candidate.currency_type?.documentId === to,
    );
    const rate = await resolve(needed.from, to, transaction.date, {
      fromCode,
      toCode: step?.currency_type?.code ?? null,
    });
    if (rate) map.set(to, rate);
  }
  return map;
}

/**
 * Member ratio for the source currency, only when the template converts to
 * another currency (flagged step with currency ≠ source) and the source has a
 * 1101/1001 side. null → multiplier 1. Conflicting ratios → 422 AMBIGUOUS.
 */
export async function loadMemberRatio(
  strapi: Pick<ConvertContextStrapi, 'db'>,
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
): Promise<MemberRatio | null> {
  const needed = stepsNeedingRate(workflow, transaction);
  if (!needed?.to.length) return null;
  const memberAccount = memberAccountFromTransaction(transaction);
  if (!memberAccount?.documentId) return null;

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

  return resolveMemberRatio(
    member?.memberships ?? [],
    transaction.currency_type?.code,
    transaction.date,
  );
}
