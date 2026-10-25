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

/** When Strapi has no `rules` JSON yet, match seeded membership-type names. */
export const EGG_RULE_FALLBACK_BY_MEMBERSHIP_TYPE_NAME: Readonly<
  Record<string, EggDistributionRule>
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

function eggRuleFromTypeRules(rules: unknown): EggDistributionRule | null {
  if (!isRecord(rules) || rules.egg === undefined) {
    return null;
  }
  return parseEggRuleFragment(rules.egg);
}

/** Validates `rules` JSON; fills defaults when keys are missing. */
export function parseEggRule(rules: unknown): EggDistributionRule {
  const fromType = eggRuleFromTypeRules(rules);
  if (fromType) {
    return fromType;
  }
  return { ...DEFAULT_EGG_RULE };
}

/** Membership override wins over membership-type defaults. */
export function resolveEggRule(
  membershipRules: unknown,
  membershipTypeRules: unknown,
  membershipTypeName?: string | null,
): EggDistributionRule {
  if (isRecord(membershipRules) && membershipRules.egg !== undefined) {
    const fromMembership = parseEggRuleFragment(
      (membershipRules as MembershipRulesJson).egg,
    );
    if (fromMembership) {
      return fromMembership;
    }
  }
  const fromType = eggRuleFromTypeRules(membershipTypeRules);
  if (fromType) {
    return fromType;
  }
  if (membershipTypeName) {
    const fallback =
      EGG_RULE_FALLBACK_BY_MEMBERSHIP_TYPE_NAME[membershipTypeName];
    if (fallback) {
      return { ...fallback };
    }
  }
  return { ...DEFAULT_EGG_RULE };
}
