import type { DataProvider, Identifier } from 'react-admin';

export type { AccountProfile } from './accountProfiles';
export {
  accountChoicesForProfile as accountChoicesForSelect,
  filterAccountsByProfile as filterAccountChoices,
} from './accountProfiles';

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
  return DEBIT_CODES.test(normalizeAccountCode(code));
}

export function isCreditCode(code: string | null | undefined): boolean {
  return CREDIT_CODES.test(normalizeAccountCode(code));
}

export function normalizeAccountCode(code: string | null | undefined): string {
  return typeof code === 'string' ? code.trim() : '';
}

export function sortAccountChoices(accounts: AccountChoice[]): AccountChoice[] {
  return [...accounts].sort((left, right) => {
    const byCode = normalizeAccountCode(left.code).localeCompare(
      normalizeAccountCode(right.code),
      'hu',
    );
    if (byCode !== 0) return byCode;
    return String(left.name ?? '').localeCompare(String(right.name ?? ''), 'hu');
  });
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

