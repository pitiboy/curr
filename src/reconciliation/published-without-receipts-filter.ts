import { accountCodeMatchesPattern } from '../transaction-workflow/convert';

export type PublishedWithoutReceiptsAccountFilter = {
  creditCodes: string[];
  debitCodes: string[];
};

const EMPTY_FILTER: PublishedWithoutReceiptsAccountFilter = {
  creditCodes: [],
  debitCodes: [],
};

function stringPatterns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * `config.publishedWithoutReceipts` from the reconciliation Settings row.
 * Empty credit+debit lists mean “no account heuristic” (all published without receipt).
 */
export function publishedWithoutReceiptsFilterFromConfig(
  config: Record<string, unknown> | null | undefined,
): PublishedWithoutReceiptsAccountFilter {
  const raw = config?.publishedWithoutReceipts;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return EMPTY_FILTER;
  }
  const row = raw as Record<string, unknown>;
  return {
    creditCodes: stringPatterns(row.creditCodes),
    debitCodes: stringPatterns(row.debitCodes),
  };
}

export function normalizePublishedWithoutReceiptsAccountFilter(
  filter: PublishedWithoutReceiptsAccountFilter | null | undefined,
): PublishedWithoutReceiptsAccountFilter {
  if (!filter || typeof filter !== 'object') {
    return EMPTY_FILTER;
  }
  return {
    creditCodes: Array.isArray(filter.creditCodes)
      ? filter.creditCodes.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    debitCodes: Array.isArray(filter.debitCodes)
      ? filter.debitCodes.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
  };
}

export function accountFilterIsActive(
  filter: PublishedWithoutReceiptsAccountFilter | null | undefined,
): boolean {
  const resolved = normalizePublishedWithoutReceiptsAccountFilter(filter);
  return resolved.creditCodes.length > 0 || resolved.debitCodes.length > 0;
}

/**
 * Likely needs a receipt when credit matches any creditCodes (e.g. bank `1100`)
 * or debit matches any debitCodes (e.g. material `5000`, services `54*`).
 */
export function matchesPublishedWithoutReceiptsAccountFilter(
  debitCode: string | number | null | undefined,
  creditCode: string | number | null | undefined,
  filter: PublishedWithoutReceiptsAccountFilter | null | undefined,
): boolean {
  const resolved = normalizePublishedWithoutReceiptsAccountFilter(filter);
  if (!accountFilterIsActive(resolved)) return true;
  const debitHit = resolved.debitCodes.some((pattern) =>
    accountCodeMatchesPattern(debitCode, pattern),
  );
  if (debitHit) return true;
  return resolved.creditCodes.some((pattern) =>
    accountCodeMatchesPattern(creditCode, pattern),
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
  );
}
