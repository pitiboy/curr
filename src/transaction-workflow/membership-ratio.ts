/**
 * Tagsági ratio szorzó a Convert árfolyamos lépéseihez (0002 plan §5.2).
 *
 * Konvenció: a tagsági `rules` JSON kulcsa a **forrás pénznem kódja kisbetűvel**
 * (EGG → `rules.egg`, HOUR → `rules.hour`). A ratio = `rules[kulcs].ratio`
 * (hiányzó ratio → 1). A `mode` mezőt a Convert nem nézi.
 *
 * Feloldás: a tag összes, a forrás napján érvényes tagsága (szervezettől
 * függetlenül); tagságonként `membership.rules[kulcs]` → `membership_type.rules[kulcs]`.
 * Csak a szabállyal rendelkező tagságok számítanak; nincs ilyen → nincs szorzó (1).
 * Eltérő ratio-k → 422 MEMBERSHIP_RATIO_AMBIGUOUS. Név szerinti fallback nincs.
 */
import {
  ERROR_MEMBERSHIP_RATIO_AMBIGUOUS,
  TransactionWorkflowError,
  isoDay,
  type MemberRatio,
} from './convert';

export type { MemberRatio };

export type MembershipRuleRow = {
  documentId?: string | null;
  name?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  rules?: unknown;
  membership_type?: { name?: string | null; rules?: unknown } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `rules` key for a currency code: trimmed, lower-case. */
export function memberRuleKey(
  currencyCode: string | null | undefined,
): string | null {
  const key = currencyCode?.trim().toLowerCase();
  return key ? key : null;
}

/** Ratio of one `rules[key]` fragment; null when absent or invalid. */
function ratioFromRules(rules: unknown, key: string): number | null {
  if (!isRecord(rules)) return null;
  const fragment = rules[key];
  if (!isRecord(fragment)) return null;
  const raw = fragment.ratio;
  if (raw === undefined || raw === null) return 1;
  const ratio = Number(raw);
  return Number.isFinite(ratio) && ratio >= 0 ? ratio : null;
}

/** Inclusive UTC day check, same as backoffice membershipValidOnDate. */
export function membershipValidOn(
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
  date: string,
): boolean {
  const day = isoDay(date);
  const dayStart = `${day}T00:00:00.000Z`;
  const dayEnd = `${day}T23:59:59.999Z`;
  if (validFrom) {
    const from = new Date(validFrom);
    if (!Number.isNaN(from.getTime()) && from.toISOString() > dayEnd) {
      return false;
    }
  }
  if (validTo) {
    const to = new Date(validTo);
    if (!Number.isNaN(to.getTime()) && to.toISOString() < dayStart) {
      return false;
    }
  }
  return true;
}

/** Ratio of one membership for `key`: membership override → type default. */
export function membershipRatioFor(
  row: MembershipRuleRow,
  key: string,
): MemberRatio | null {
  const own = ratioFromRules(row.rules, key);
  const ratio = own ?? ratioFromRules(row.membership_type?.rules, key);
  if (ratio === null) return null;
  return {
    ratio,
    membershipDocumentId: row.documentId ?? null,
    membershipName: row.name ?? row.membership_type?.name ?? null,
    source: own !== null ? 'membership' : 'membership_type',
  };
}

/**
 * Member ratio for the source currency on `date`; null when no valid
 * membership has a rule for it (→ multiplier 1). Conflicting ratios → 422.
 */
export function resolveMemberRatio(
  memberships: readonly MembershipRuleRow[] | null | undefined,
  currencyCode: string | null | undefined,
  date: string,
): MemberRatio | null {
  const key = memberRuleKey(currencyCode);
  if (!key) return null;
  const found: MemberRatio[] = [];
  for (const row of memberships ?? []) {
    if (!membershipValidOn(row.valid_from, row.valid_to, date)) continue;
    const ratio = membershipRatioFor(row, key);
    if (ratio) found.push(ratio);
  }
  if (!found.length) return null;
  const distinct = new Set(found.map((row) => row.ratio));
  if (distinct.size > 1) {
    throw new TransactionWorkflowError(
      `Member has valid memberships with different "${key}" ratios (${found
        .map((row) => `${row.membershipName ?? 'membership'}: ${row.ratio}`)
        .join(', ')})`,
      422,
      ERROR_MEMBERSHIP_RATIO_AMBIGUOUS,
      { key, date: isoDay(date), memberships: found },
    );
  }
  return found[0];
}
