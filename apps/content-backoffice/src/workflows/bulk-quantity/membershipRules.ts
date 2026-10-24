/** Typed shape for membership / membership-type `rules` JSON (extensible per resource key). */

export type EggDistributionRule = {
  mode: 'internal' | 'sale';
  ratio: number;
};

export type MembershipRulesJson = {
  egg?: Partial<EggDistributionRule>;
};

const DEFAULT_EGG_RULE: EggDistributionRule = {
  mode: 'sale',
  ratio: 1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEggRuleFragment(value: unknown): EggDistributionRule | null {
  if (!isRecord(value)) {
    return null;
  }
  const mode = value.mode;
  if (mode !== 'internal' && mode !== 'sale') {
    return null;
  }
  const ratioRaw = value.ratio;
  const ratio =
    ratioRaw === undefined || ratioRaw === null
      ? DEFAULT_EGG_RULE.ratio
      : Number(ratioRaw);
  if (!Number.isFinite(ratio) || ratio < 0) {
    return null;
  }
  return { mode, ratio };
}

/** Validates `rules` JSON; fills defaults when keys are missing. */
export function parseEggRule(rules: unknown): EggDistributionRule {
  if (!isRecord(rules)) {
    return { ...DEFAULT_EGG_RULE };
  }
  const egg = rules.egg;
  const parsed = parseEggRuleFragment(egg);
  if (!parsed) {
    return { ...DEFAULT_EGG_RULE };
  }
  return parsed;
}

/** Membership override wins over membership-type defaults. */
export function resolveEggRule(
  membershipRules: unknown,
  membershipTypeRules: unknown,
): EggDistributionRule {
  if (isRecord(membershipRules) && membershipRules.egg !== undefined) {
    const fromMembership = parseEggRuleFragment(
      (membershipRules as MembershipRulesJson).egg,
    );
    if (fromMembership) {
      return fromMembership;
    }
  }
  return parseEggRule(membershipTypeRules);
}
