import { accountCodeMatchesPattern } from '../transaction-workflow/convert';

export type PublishedWithoutReceiptsAccountRule = {
  creditCodes: string[];
  debitCodes: string[];
};

export type PublishedWithoutReceiptsAccountFilter = {
  /** Any rule may match; within a rule every non-empty side must match (AND). */
  rules: PublishedWithoutReceiptsAccountRule[];
  /** Skip rows whose currency code matches (e.g. internal KOR locks). */
  excludeCurrencyCodes: string[];
};

const EMPTY_FILTER: PublishedWithoutReceiptsAccountFilter = {
  rules: [],
  excludeCurrencyCodes: [],
};

function stringPatterns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseRule(value: unknown): PublishedWithoutReceiptsAccountRule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const creditCodes = stringPatterns(row.creditCodes);
  const debitCodes = stringPatterns(row.debitCodes);
  if (creditCodes.length === 0 && debitCodes.length === 0) return null;
  return { creditCodes, debitCodes };
}

/**
 * `config.publishedWithoutReceipts` from the reconciliation Settings row.
 *
 * Preferred shape:
 * `{ rules: [{ debitCodes, creditCodes }], excludeCurrencyCodes?: string[] }`
 *
 * Legacy flat `{ debitCodes, creditCodes }` becomes a single AND rule.
 * Empty rules mean “no account heuristic” (all published without receipt).
 */
export function publishedWithoutReceiptsFilterFromConfig(
  config: Record<string, unknown> | null | undefined,
): PublishedWithoutReceiptsAccountFilter {
  const raw = config?.publishedWithoutReceipts;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return EMPTY_FILTER;
  }
  const row = raw as Record<string, unknown>;
  const excludeCurrencyCodes = stringPatterns(row.excludeCurrencyCodes);

  if (Array.isArray(row.rules)) {
    const rules = row.rules
      .map(parseRule)
      .filter(
        (rule): rule is PublishedWithoutReceiptsAccountRule => rule != null,
      );
    return { rules, excludeCurrencyCodes };
  }

  const legacy = parseRule(row);
  return {
    rules: legacy ? [legacy] : [],
    excludeCurrencyCodes,
  };
}

export function normalizePublishedWithoutReceiptsAccountFilter(
  filter: PublishedWithoutReceiptsAccountFilter | null | undefined,
): PublishedWithoutReceiptsAccountFilter {
  if (!filter || typeof filter !== 'object') {
    return EMPTY_FILTER;
  }
  const rules = Array.isArray(filter.rules)
    ? filter.rules
        .map(parseRule)
        .filter(
          (rule): rule is PublishedWithoutReceiptsAccountRule => rule != null,
        )
    : [];
  // Legacy in-memory shape: top-level debit/credit without `rules`.
  if (
    rules.length === 0 &&
    ('debitCodes' in filter || 'creditCodes' in filter)
  ) {
    const legacy = parseRule(filter);
    return {
      rules: legacy ? [legacy] : [],
      excludeCurrencyCodes: stringPatterns(
        (filter as { excludeCurrencyCodes?: unknown }).excludeCurrencyCodes,
      ),
    };
  }
  return {
    rules,
    excludeCurrencyCodes: stringPatterns(filter.excludeCurrencyCodes),
  };
}

export function accountFilterIsActive(
  filter: PublishedWithoutReceiptsAccountFilter | null | undefined,
): boolean {
  return (
    normalizePublishedWithoutReceiptsAccountFilter(filter).rules.length > 0
  );
}

function sideMatches(
  code: string | number | null | undefined,
  patterns: readonly string[],
): boolean {
  if (patterns.length === 0) return true;
  return patterns.some((pattern) => accountCodeMatchesPattern(code, pattern));
}

function ruleMatches(
  debitCode: string | number | null | undefined,
  creditCode: string | number | null | undefined,
  rule: PublishedWithoutReceiptsAccountRule,
): boolean {
  return (
    sideMatches(debitCode, rule.debitCodes) &&
    sideMatches(creditCode, rule.creditCodes)
  );
}

/**
 * Likely needs a receipt when a configured rule matches (debit AND credit
 * patterns within the rule) and the currency is not excluded.
 */
export function matchesPublishedWithoutReceiptsAccountFilter(
  debitCode: string | number | null | undefined,
  creditCode: string | number | null | undefined,
  filter: PublishedWithoutReceiptsAccountFilter | null | undefined,
  currencyCode?: string | number | null | undefined,
): boolean {
  const resolved = normalizePublishedWithoutReceiptsAccountFilter(filter);
  if (!accountFilterIsActive(resolved)) return true;

  const currency =
    typeof currencyCode === 'string' || typeof currencyCode === 'number'
      ? String(currencyCode).trim()
      : '';
  if (
    currency &&
    resolved.excludeCurrencyCodes.some((pattern) =>
      accountCodeMatchesPattern(currency, pattern),
    )
  ) {
    return false;
  }

  return resolved.rules.some((rule) =>
    ruleMatches(debitCode, creditCode, rule),
  );
}

function accountCodeFromRelation(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const code = (value as { code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number'
    ? String(code).trim()
    : '';
}

export function transactionMatchesPublishedWithoutReceiptsFilter(
  row: Record<string, unknown>,
  filter: PublishedWithoutReceiptsAccountFilter | null | undefined,
): boolean {
  return matchesPublishedWithoutReceiptsAccountFilter(
    accountCodeFromRelation(row.debit_account),
    accountCodeFromRelation(row.credit_account),
    filter,
    accountCodeFromRelation(row.currency_type),
  );
}
