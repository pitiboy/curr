import type { DataProvider, Identifier } from 'react-admin';

export type AccountChoice = {
  id: Identifier;
  code?: string | null;
  name?: string | null;
};

export const DEFAULT_DEBIT_CODES = /^5/;
export const DEFAULT_CREDIT_CODES = /^(1|3)/;

export type AccountCodePatterns = {
  debit: RegExp;
  credit: RegExp;
};

export const DEFAULT_ACCOUNT_CODE_PATTERNS: AccountCodePatterns = {
  debit: DEFAULT_DEBIT_CODES,
  credit: DEFAULT_CREDIT_CODES,
};

export function isDebitCode(
  code: string | null | undefined,
  pattern: RegExp = DEFAULT_DEBIT_CODES,
): boolean {
  return pattern.test(normalizeAccountCode(code));
}

export function isCreditCode(
  code: string | null | undefined,
  pattern: RegExp = DEFAULT_CREDIT_CODES,
): boolean {
  return pattern.test(normalizeAccountCode(code));
}

export function filterAccountChoices(
  accounts: AccountChoice[],
  kind: 'debit' | 'credit',
  patterns: AccountCodePatterns = DEFAULT_ACCOUNT_CODE_PATTERNS,
): AccountChoice[] {
  const matches =
    kind === 'debit'
      ? (code: string | null | undefined) => isDebitCode(code, patterns.debit)
      : (code: string | null | undefined) =>
          isCreditCode(code, patterns.credit);
  return sortAccountChoices(
    accounts.filter((account) => matches(account.code)),
  );
}

export function sortAccountChoices(accounts: AccountChoice[]): AccountChoice[] {
  return [...accounts].sort((left, right) => {
    const byCode = normalizeAccountCode(left.code).localeCompare(
      normalizeAccountCode(right.code),
      'hu',
    );
    if (byCode !== 0) return byCode;
    return String(left.name ?? '').localeCompare(
      String(right.name ?? ''),
      'hu',
    );
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
 * Pattern string from `/api/backoffice/config`, either `/^5/` or `^5`.
 * An empty value keeps the fallback. `g` and `y` are dropped so `.test()` stays stable.
 */
export function parseCodeRegex(
  value: string | undefined,
  fallback: RegExp,
): RegExp {
  const source = value?.trim();
  if (!source) return fallback;
  const literal = /^\/([\s\S]+)\/([a-z]*)$/.exec(source);
  const pattern = literal
    ? new RegExp(literal[1], literal[2])
    : new RegExp(source);
  const flags = pattern.flags.replace(/[gy]/g, '');
  return flags === pattern.flags ? pattern : new RegExp(pattern.source, flags);
}

export function normalizeAccountCode(code: string | null | undefined): string {
  return typeof code === 'string' ? code.trim() : '';
}
