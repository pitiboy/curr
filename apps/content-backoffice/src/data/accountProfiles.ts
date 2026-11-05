import type { AccountChoice } from './accountCodes';
import {
  DEFAULT_ACCOUNT_CODE_PATTERNS,
  isCreditCode,
  isDebitCode,
  normalizeAccountCode,
  sortAccountChoices,
  type AccountCodePatterns,
} from './accountCodes';

/** Empty string = no profile filter (all loaded accounts). */
export type AccountProfile = '' | 'cost' | 'revenue';

const REVENUE_CREDIT = /^4/;

type NonEmptyAccountProfile = Exclude<AccountProfile, ''>;

function accountMatchesProfile(
  account: AccountChoice,
  kind: 'debit' | 'credit',
  profile: NonEmptyAccountProfile,
  patterns: AccountCodePatterns,
): boolean {
  const code = normalizeAccountCode(account.code);
  switch (profile) {
    case 'cost':
      return kind === 'debit'
        ? isDebitCode(code, patterns.debit)
        : isCreditCode(code, patterns.credit);
    case 'revenue':
      return kind === 'debit'
        ? patterns.credit.test(code)
        : REVENUE_CREDIT.test(code);
    default:
      return true;
  }
}

export function filterAccountsByProfile(
  accounts: AccountChoice[],
  kind: 'debit' | 'credit',
  profile: AccountProfile = 'cost',
  patterns: AccountCodePatterns = DEFAULT_ACCOUNT_CODE_PATTERNS,
): AccountChoice[] {
  if (profile === '') {
    return sortAccountChoices(accounts);
  }
  return sortAccountChoices(
    accounts.filter((account) =>
      accountMatchesProfile(account, kind, profile, patterns),
    ),
  );
}

/** Keeps the current selection visible when it falls outside the active profile filter. */
export function accountChoicesForProfile(
  accounts: AccountChoice[],
  kind: 'debit' | 'credit',
  profile: AccountProfile,
  selectedId: unknown,
  patterns: AccountCodePatterns = DEFAULT_ACCOUNT_CODE_PATTERNS,
  /** When set (workflow incomplete prefill), restrict to this exact ledger code. */
  exactCode?: string | null,
): AccountChoice[] {
  const filtered =
    exactCode != null && exactCode !== ''
      ? sortAccountChoices(
          accounts.filter(
            (account) =>
              normalizeAccountCode(account.code) ===
              normalizeAccountCode(exactCode),
          ),
        )
      : filterAccountsByProfile(accounts, kind, profile, patterns);
  if (selectedId === null || selectedId === undefined || selectedId === '') {
    return filtered;
  }
  const id = String(selectedId);
  if (filtered.some((row) => String(row.id) === id)) return filtered;
  const selected = accounts.find((row) => String(row.id) === id);
  return selected ? sortAccountChoices([...filtered, selected]) : filtered;
}

/** Cost / revenue profiles for the create and review account row. */
export function selectableAccountProfiles(): NonEmptyAccountProfile[] {
  return ['cost', 'revenue'];
}

export function selectableAccountProfilesWithAll(): AccountProfile[] {
  return ['', ...selectableAccountProfiles()];
}
