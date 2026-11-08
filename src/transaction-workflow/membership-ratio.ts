/**
 * Tagsági tojás-ratio őr a Convert árfolyamos lépéseihez (0002 plan §5.2).
 * A Convert nem szoroz a tagsági ratio-val; ha a forrás tagjának a forrás napján
 * érvényes tagsága ≠ 1 ratio-t ad, az előnézet figyelmeztet, a Convert 422-vel leáll.
 *
 * A szabály-feloldás a backoffice
 * `apps/content-backoffice/src/workflows/bulk-quantity/membershipRules.ts`
 * (`resolveEggRule`) és `distributionLogic.ts` (`membershipValidOnDate`)
 * szerveroldali másolata — a két helyet együtt kell módosítani.
 */
import {
  ERROR_MEMBERSHIP_RATIO_UNSUPPORTED,
  TransactionWorkflowError,
  isoDay,
} from './convert';

type EggRule = { mode: 'internal' | 'sale'; ratio: number };

const DEFAULT_EGG_RULE: EggRule = { mode: 'sale', ratio: 1 };

/** Must match EGG_RULE_FALLBACK_BY_MEMBERSHIP_TYPE_NAME in the backoffice. */
export const SERVER_EGG_RULE_FALLBACK_BY_MEMBERSHIP_TYPE_NAME: Readonly<
  Record<string, EggRule>
> = {
  'Bentlakó tag': { mode: 'internal', ratio: 1 },
  'Társult tag': { mode: 'internal', ratio: 1 },
  'Partner / Bedolgozó': { mode: 'sale', ratio: 1 },
  Vásárló: { mode: 'sale', ratio: 1 },
  'Pártoló tag': { mode: 'sale', ratio: 1 },
  Érdeklődő: { mode: 'sale', ratio: 0.75 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEggRuleFragment(value: unknown): EggRule | null {
  if (!isRecord(value)) return null;
  const mode = value.mode;
  if (mode !== 'internal' && mode !== 'sale') return null;
  const ratioRaw = value.ratio;
  const ratio =
    ratioRaw === undefined || ratioRaw === null
      ? DEFAULT_EGG_RULE.ratio
      : Number(ratioRaw);
  if (!Number.isFinite(ratio) || ratio < 0) return null;
  return { mode, ratio };
}

/** membership.rules.egg → membership_type.rules.egg → type-name fallback → default. */
export function resolveServerEggRule(
  membershipRules: unknown,
  membershipTypeRules: unknown,
  membershipTypeName?: string | null,
): EggRule {
  if (isRecord(membershipRules) && membershipRules.egg !== undefined) {
    const fromMembership = parseEggRuleFragment(membershipRules.egg);
    if (fromMembership) return fromMembership;
  }
  if (isRecord(membershipTypeRules) && membershipTypeRules.egg !== undefined) {
    const fromType = parseEggRuleFragment(membershipTypeRules.egg);
    if (fromType) return fromType;
  }
  if (membershipTypeName) {
    const fallback =
      SERVER_EGG_RULE_FALLBACK_BY_MEMBERSHIP_TYPE_NAME[membershipTypeName];
    if (fallback) return { ...fallback };
  }
  return { ...DEFAULT_EGG_RULE };
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

export type MembershipRuleRow = {
  documentId?: string | null;
  name?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  rules?: unknown;
  membership_type?: { name?: string | null; rules?: unknown } | null;
};

export type MembershipRatioIssue = {
  membershipDocumentId: string | null;
  membershipName: string | null;
  membershipTypeName: string | null;
  ratio: number;
};

/** Memberships valid on `date` whose resolved egg ratio is not 1. */
export function findUnsupportedMembershipRatios(
  memberships: readonly MembershipRuleRow[] | null | undefined,
  date: string,
): MembershipRatioIssue[] {
  const issues: MembershipRatioIssue[] = [];
  for (const row of memberships ?? []) {
    if (!membershipValidOn(row.valid_from, row.valid_to, date)) continue;
    const typeName = row.membership_type?.name ?? null;
    const rule = resolveServerEggRule(
      row.rules,
      row.membership_type?.rules,
      typeName,
    );
    if (Math.abs(rule.ratio - 1) > 1e-9) {
      issues.push({
        membershipDocumentId: row.documentId ?? null,
        membershipName: row.name ?? null,
        membershipTypeName: typeName,
        ratio: rule.ratio,
      });
    }
  }
  return issues;
}

export const MEMBERSHIP_RATIO_WARNING_PREFIX = `${ERROR_MEMBERSHIP_RATIO_UNSUPPORTED}:`;

function describeIssues(issues: readonly MembershipRatioIssue[]): string {
  return issues
    .map(
      (issue) =>
        `${issue.membershipName ?? issue.membershipTypeName ?? 'membership'} (ratio ${issue.ratio})`,
    )
    .join(', ');
}

/** Preview warning text; null when nothing to report. */
export function membershipRatioWarning(
  issues: readonly MembershipRatioIssue[],
): string | null {
  if (!issues.length) return null;
  return `${MEMBERSHIP_RATIO_WARNING_PREFIX} member egg ratio is not 1 — ${describeIssues(issues)}. Convert does not apply membership ratio; book this sale via the daily egg form.`;
}

/** Convert guard: throws 422 MEMBERSHIP_RATIO_UNSUPPORTED when issues exist. */
export function assertMembershipRatioSupported(
  issues: readonly MembershipRatioIssue[],
): void {
  if (!issues.length) return;
  throw new TransactionWorkflowError(
    `Member egg ratio is not 1 (${describeIssues(issues)}); convert does not apply membership ratio`,
    422,
    ERROR_MEMBERSHIP_RATIO_UNSUPPORTED,
    { memberships: issues },
  );
}
