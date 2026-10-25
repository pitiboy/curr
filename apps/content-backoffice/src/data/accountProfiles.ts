import type { AccountChoice } from './accountCodes';
import {
  CREDIT_CODES,
  isCreditCode,
  isDebitCode,
  normalizeAccountCode,
  sortAccountChoices,
} from './accountCodes';

/** Empty string = no profile filter (all loaded accounts). */
export type AccountProfile =
  | ''
  | 'cost'
  | 'revenue'
  | 'egg-production'
  | 'egg-internal'
  | 'egg-sale';

export const EGG_DAILY_ENTRY_WORKFLOW_ID = 'egg-daily-entry';

const EGG_PRODUCTION_DEBIT = '1300';
const EGG_PRODUCTION_CREDIT = '4500';
const EGG_INTERNAL_DEBIT = '1001';
const EGG_INTERNAL_CREDIT = '1300';
const EGG_SALE_DEBIT_CODES = new Set(['1001', '1000', '4000']);
const EGG_SALE_CREDIT_CODES = new Set(['1300', '1001', '1000']);

const REVENUE_DEBIT = CREDIT_CODES;
const REVENUE_CREDIT = /^4/;

type NonEmptyAccountProfile = Exclude<AccountProfile, ''>;

const PROFILE_WORKFLOW: Partial<Record<NonEmptyAccountProfile, string>> = {
  'egg-production': EGG_DAILY_ENTRY_WORKFLOW_ID,
  'egg-internal': EGG_DAILY_ENTRY_WORKFLOW_ID,
  'egg-sale': EGG_DAILY_ENTRY_WORKFLOW_ID,
};

function codeInSet(code: string | null | undefined, allowed: Set<string>): boolean {
  return allowed.has(normalizeAccountCode(code));
}

function accountMatchesProfile(
  account: AccountChoice,
  kind: 'debit' | 'credit',
  profile: NonEmptyAccountProfile,
): boolean {
  const code = normalizeAccountCode(account.code);
  switch (profile) {
    case 'cost':
      return kind === 'debit' ? isDebitCode(code) : isCreditCode(code);
    case 'revenue':
      return kind === 'debit'
        ? REVENUE_DEBIT.test(code)
        : REVENUE_CREDIT.test(code);
    case 'egg-production':
      return kind === 'debit'
        ? code === EGG_PRODUCTION_DEBIT
        : code === EGG_PRODUCTION_CREDIT;
    case 'egg-internal':
      return kind === 'debit'
        ? code === EGG_INTERNAL_DEBIT
        : code === EGG_INTERNAL_CREDIT;
    case 'egg-sale':
      return kind === 'debit'
        ? codeInSet(code, EGG_SALE_DEBIT_CODES)
        : codeInSet(code, EGG_SALE_CREDIT_CODES);
    default:
      return true;
  }
}

export function filterAccountsByProfile(
  accounts: AccountChoice[],
  kind: 'debit' | 'credit',
  profile: AccountProfile = 'cost',
): AccountChoice[] {
  if (profile === '') {
    return sortAccountChoices(accounts);
  }
  return sortAccountChoices(
    accounts.filter((account) => accountMatchesProfile(account, kind, profile)),
  );
}

/** Keeps the current selection visible when it falls outside the active profile filter. */
export function accountChoicesForProfile(
  accounts: AccountChoice[],
  kind: 'debit' | 'credit',
  profile: AccountProfile,
  selectedId: unknown,
): AccountChoice[] {
  const filtered = filterAccountsByProfile(accounts, kind, profile);
  if (selectedId === null || selectedId === undefined || selectedId === '') {
    return filtered;
  }
  const id = String(selectedId);
  if (filtered.some((row) => String(row.id) === id)) return filtered;
  const selected = accounts.find((row) => String(row.id) === id);
  return selected ? sortAccountChoices([...filtered, selected]) : filtered;
}

/** Non-empty profiles gated by `effective` workflow ids from BackofficeConfigContext. */
export function selectableAccountProfiles(
  effectiveWorkflowIds: readonly string[],
  configReady: boolean,
): NonEmptyAccountProfile[] {
  const effective = new Set(effectiveWorkflowIds);
  const profiles: NonEmptyAccountProfile[] = ['cost', 'revenue'];
  if (!configReady) {
    return profiles;
  }
  for (const profile of [
    'egg-production',
    'egg-internal',
    'egg-sale',
  ] as const) {
    const workflowId = PROFILE_WORKFLOW[profile];
    if (workflowId && effective.has(workflowId)) {
      profiles.push(profile);
    }
  }
  return profiles;
}

export function selectableAccountProfilesWithAll(
  effectiveWorkflowIds: readonly string[],
  configReady: boolean,
): AccountProfile[] {
  return ['', ...selectableAccountProfiles(effectiveWorkflowIds, configReady)];
}
