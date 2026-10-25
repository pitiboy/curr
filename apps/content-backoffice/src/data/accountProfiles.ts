import type { AccountChoice } from './accountCodes';
import {
  CREDIT_CODES,
  isCreditCode,
  isDebitCode,
  normalizeAccountCode,
  sortAccountChoices,
} from './accountCodes';
import {
  EGG_DAILY_ENTRY_WORKFLOW_ID,
  EGG_GATED_ACCOUNT_PROFILES,
  EGG_INTERNAL_CREDIT_ACCOUNT_CODE,
  EGG_INTERNAL_DEBIT_ACCOUNT_CODE,
  EGG_PRODUCTION_CREDIT_ACCOUNT_CODE,
  EGG_PRODUCTION_DEBIT_ACCOUNT_CODE,
  EGG_SALE_CREDIT_ACCOUNT_CODES,
  EGG_SALE_DEBIT_ACCOUNT_CODES,
  type EggGatedAccountProfile,
} from '../workflows/bulk-quantity/eggDailyEntry.constants';

/** Empty string = no profile filter (all loaded accounts). */
export type AccountProfile = '' | 'cost' | 'revenue' | EggGatedAccountProfile;

export { EGG_DAILY_ENTRY_WORKFLOW_ID };

const EGG_SALE_DEBIT_CODES = new Set<string>(EGG_SALE_DEBIT_ACCOUNT_CODES);
const EGG_SALE_CREDIT_CODES = new Set<string>(EGG_SALE_CREDIT_ACCOUNT_CODES);

/** Bevétel profil tartozik oldalán mérleg-szerű (1/3) kódok, követel oldalán 4-es bevétel. */
const revenueDebitPattern = CREDIT_CODES;
const REVENUE_CREDIT = /^4/;

type NonEmptyAccountProfile = Exclude<AccountProfile, ''>;

const PROFILE_WORKFLOW: Record<EggGatedAccountProfile, string> =
  Object.fromEntries(
    EGG_GATED_ACCOUNT_PROFILES.map((profile) => [
      profile,
      EGG_DAILY_ENTRY_WORKFLOW_ID,
    ]),
  ) as Record<EggGatedAccountProfile, string>;

function codeInSet(
  code: string | null | undefined,
  allowed: Set<string>,
): boolean {
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
        ? revenueDebitPattern.test(code)
        : REVENUE_CREDIT.test(code);
    case 'egg-production':
      return kind === 'debit'
        ? code === EGG_PRODUCTION_DEBIT_ACCOUNT_CODE
        : code === EGG_PRODUCTION_CREDIT_ACCOUNT_CODE;
    case 'egg-internal':
      return kind === 'debit'
        ? code === EGG_INTERNAL_DEBIT_ACCOUNT_CODE
        : code === EGG_INTERNAL_CREDIT_ACCOUNT_CODE;
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
  for (const profile of EGG_GATED_ACCOUNT_PROFILES) {
    const workflowId = PROFILE_WORKFLOW[profile];
    if (effective.has(workflowId)) {
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
