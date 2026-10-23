import type { DataProvider, Identifier } from 'react-admin';

export type AccountChoice = {
  id: Identifier;
  code?: string | null;
  name?: string | null;
};

const DEFAULT_DEBIT_CODES = /^5/;
const DEFAULT_CREDIT_CODES = /^(1|3)/;

/** `VITE_DEBIT_CODES`, or `/^5/` when that variable is absent. */
export const DEBIT_CODES = parseCodeRegex(
  import.meta.env.VITE_DEBIT_CODES,
  DEFAULT_DEBIT_CODES,
);

/** `VITE_CREDIT_CODES`, or `/^(1|3)/` when that variable is absent. */
export const CREDIT_CODES = parseCodeRegex(
  import.meta.env.VITE_CREDIT_CODES,
  DEFAULT_CREDIT_CODES,
);

export function isDebitCode(code: string | null | undefined): boolean {
  return DEBIT_CODES.test(normalizeCode(code));
}

export function isCreditCode(code: string | null | undefined): boolean {
  return CREDIT_CODES.test(normalizeCode(code));
}

/** Egg daily entry workflow (see eggDailyEntry.config on egg-daily-entry branch). */
export const EGG_DEBIT_ACCOUNT_CODE = '1300';
export const EGG_CREDIT_ACCOUNT_CODE = '4500';

/** Empty string means every account; cost and egg are client-side review filters only. */
export type AccountProfile = '' | 'cost' | 'egg';

function accountMatchesProfile(
  account: AccountChoice,
  kind: 'debit' | 'credit',
  profile: AccountProfile,
): boolean {
  if (profile === '') return true;
  if (profile === 'cost') {
    return kind === 'debit'
      ? isDebitCode(account.code)
      : isCreditCode(account.code);
  }
  const code = normalizeCode(account.code);
  return kind === 'debit'
    ? code === EGG_DEBIT_ACCOUNT_CODE
    : code === EGG_CREDIT_ACCOUNT_CODE;
}

function sortAccountChoices(accounts: AccountChoice[]): AccountChoice[] {
  return [...accounts].sort((left, right) => {
    const byCode = normalizeCode(left.code).localeCompare(
      normalizeCode(right.code),
      'hu',
    );
    if (byCode !== 0) return byCode;
    return String(left.name ?? '').localeCompare(String(right.name ?? ''), 'hu');
  });
}

export function filterAccountChoices(
  accounts: AccountChoice[],
  kind: 'debit' | 'credit',
  profile: AccountProfile = 'cost',
): AccountChoice[] {
  return sortAccountChoices(
    accounts.filter((account) => accountMatchesProfile(account, kind, profile)),
  );
}

/** Keeps the current selection visible when it falls outside the active profile filter. */
export function accountChoicesForSelect(
  accounts: AccountChoice[],
  kind: 'debit' | 'credit',
  profile: AccountProfile,
  selectedId: unknown,
): AccountChoice[] {
  const filtered = filterAccountChoices(accounts, kind, profile);
  if (selectedId === null || selectedId === undefined || selectedId === '') {
    return filtered;
  }
  const id = String(selectedId);
  if (filtered.some((row) => String(row.id) === id)) return filtered;
  const selected = accounts.find((row) => String(row.id) === id);
  return selected ? sortAccountChoices([...filtered, selected]) : filtered;
}

export function accountChoiceLabel(account: AccountChoice): string {
  return [account.code, account.name].filter(Boolean).join(' ');
}

/**
 * Loads every account page, then the caller filters codes in the client.
 * The code list is not a server policy.
 */
export async function loadAllAccounts(
  getList: DataProvider['getList'],
): Promise<AccountChoice[]> {
  const pageSize = 100;
  const rows: AccountChoice[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (rows.length < total && page <= 20) {
    const result = await getList('accounts', {
      pagination: { page, perPage: pageSize },
      sort: { field: 'code', order: 'ASC' },
      filter: {},
    });
    const batch = (result.data ?? []) as AccountChoice[];
    rows.push(...batch);
    total = result.total ?? rows.length;
    if (batch.length === 0) break;
    page += 1;
  }

  return rows;
}

/**
 * Env value is a JavaScript regex, either `/^5/` or `^5`.
 * An empty value keeps the fallback. `g` and `y` are dropped so `.test()` stays stable.
 */
export function parseCodeRegex(value: string | undefined, fallback: RegExp): RegExp {
  const source = value?.trim();
  if (!source) return fallback;
  const literal = /^\/([\s\S]+)\/([a-z]*)$/.exec(source);
  const pattern = literal
    ? new RegExp(literal[1], literal[2])
    : new RegExp(source);
  const flags = pattern.flags.replace(/[gy]/g, '');
  return flags === pattern.flags ? pattern : new RegExp(pattern.source, flags);
}

function normalizeCode(code: string | null | undefined): string {
  return typeof code === 'string' ? code.trim() : '';
}
