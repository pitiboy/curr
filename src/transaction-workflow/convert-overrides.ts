/**
 * Validate client-supplied step legs for a customised convert (preview overrides).
 */
import {
  ERROR_TRANSACTION_ALREADY_CONVERTED,
  KOR_TREASURY_ACCOUNT_CODE,
  TransactionWorkflowError,
  expandWorkflowSteps,
  normalizeCurrencyCode,
  roundAmount,
  stepAmount,
  type AccountRef,
  type ExpandedStepRow,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert';
import type { RateByCurrency } from './convert';
import type { MemberRatio } from './convert';

export const ERROR_CONVERT_OVERRIDES_FORBIDDEN = 'CONVERT_OVERRIDES_FORBIDDEN';

/** Appended to step descriptions when overrides were used (audit trail). */
export const CUSTOMISED_CONVERSION_NOTE = '[egyedi kifejtés]';

export type ConvertLegOverrideInput = {
  /** Stable client id (`step:0`, `custom:…`). */
  key: string;
  /** Baseline workflow step index, or null for added rows. */
  sourceStepIndex: number | null;
  description: string;
  amount: number;
  percent: number | null;
  debitAccountDocumentId: string;
  creditAccountDocumentId: string;
  currencyTypeDocumentId: string;
  organizationDocumentId?: string | null;
  transactionTypeDocumentId?: string | null;
  copyReceipt: boolean;
  date?: string;
};

export type ConvertOverridesPayload = {
  /** When set, replaces workflow-generated step rows. */
  legs?: ConvertLegOverrideInput[];
  /** When set, overrides workflow.keep_original for this convert only. */
  keepOriginal?: boolean;
  /** When set, overrides workflow.steps_published for this convert only. */
  stepsPublished?: boolean;
};

export function hasConvertOverrides(
  overrides: ConvertOverridesPayload | null | undefined,
): boolean {
  if (!overrides) return false;
  return (
    Boolean(overrides.legs?.length) ||
    typeof overrides.keepOriginal === 'boolean' ||
    typeof overrides.stepsPublished === 'boolean'
  );
}

/**
 * `entered_key` maxLength is 64. Client keys are often `custom:<uuid>` (~43 chars);
 * prefixing `documentId:step:custom:` overflows. Keep a short stable token.
 */
export function customLegEnteredKey(
  documentId: string,
  clientKey: string,
): string {
  const token =
    clientKey
      .replace(/^custom:/i, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 16) || 'x';
  const key = `${documentId}:c:${token}`;
  return key.length <= 64 ? key : key.slice(0, 64);
}

export type OverrideAccountSnapshot = ReadonlyMap<
  string,
  { documentId: string; code?: string | number | null }
>;

export type OverrideCurrencySnapshot = ReadonlyMap<
  string,
  { documentId: string; code?: string | null }
>;

function requireNonEmpty(value: string | undefined, label: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new TransactionWorkflowError(`${label} is required`, 422);
  }
  return trimmed;
}

function accountCode(
  accounts: OverrideAccountSnapshot,
  documentId: string,
): string | null {
  const row = accounts.get(documentId);
  const code = row?.code;
  if (code == null || code === '') return null;
  return String(code).trim();
}

function currencyCode(
  currencies: OverrideCurrencySnapshot,
  documentId: string,
): string | null {
  const row = currencies.get(documentId);
  return normalizeCurrencyCode(row?.code ?? null);
}

function baselineAllowsKorTreasury(
  baseline: ExpandedStepRow[],
  accounts: OverrideAccountSnapshot,
  currencies: OverrideCurrencySnapshot,
): boolean {
  return baseline.some((row) => {
    const debitCode = accountCode(accounts, row.debit_account.documentId);
    const creditCode = accountCode(accounts, row.credit_account.documentId);
    const cur = currencyCode(currencies, row.currency_type.documentId);
    return (
      cur === 'KOR' &&
      (debitCode === KOR_TREASURY_ACCOUNT_CODE ||
        creditCode === KOR_TREASURY_ACCOUNT_CODE)
    );
  });
}

function legTouchesKorTreasury(
  leg: ConvertLegOverrideInput,
  accounts: OverrideAccountSnapshot,
  currencies: OverrideCurrencySnapshot,
): boolean {
  const cur = currencyCode(currencies, leg.currencyTypeDocumentId);
  if (cur !== 'KOR') return false;
  const debit = accountCode(accounts, leg.debitAccountDocumentId);
  const credit = accountCode(accounts, leg.creditAccountDocumentId);
  return (
    debit === KOR_TREASURY_ACCOUNT_CODE || credit === KOR_TREASURY_ACCOUNT_CODE
  );
}

function roundLegAmount(
  amount: number,
  currencyDocumentId: string,
  currencies: OverrideCurrencySnapshot,
): number {
  const code = currencyCode(currencies, currencyDocumentId);
  if (code === 'HUF') {
    return Math.round(amount);
  }
  return roundAmount(amount);
}

function noteCustomisedDescription(description: string): string {
  const trimmed = description.trim();
  if (trimmed.includes(CUSTOMISED_CONVERSION_NOTE)) return trimmed;
  if (!trimmed) return CUSTOMISED_CONVERSION_NOTE;
  return `${trimmed} ${CUSTOMISED_CONVERSION_NOTE}`;
}

/**
 * Merge validated overrides into ExpandedStepRow payloads ready for create.
 */
export function resolveCustomisedStepRows(
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
  siblingByCode: ReadonlyMap<string, AccountRef>,
  rates: RateByCurrency | undefined,
  memberRatio: MemberRatio | null | undefined,
  overrides: ConvertOverridesPayload,
  accounts: OverrideAccountSnapshot,
  currencies: OverrideCurrencySnapshot,
): ExpandedStepRow[] {
  const legs = overrides.legs ?? [];
  if (!legs.length) {
    throw new TransactionWorkflowError('Override legs cannot be empty', 422);
  }

  const baseline = expandWorkflowSteps(
    workflow,
    transaction,
    siblingByCode,
    rates,
    memberRatio,
  );

  const baselineByIndex = new Map<number, ExpandedStepRow>();
  for (const row of baseline) {
    baselineByIndex.set(row.index, row);
  }

  const allowKorTreasury = baselineAllowsKorTreasury(
    baseline,
    accounts,
    currencies,
  );

  const sourceAmount = Number(transaction.amount);
  const usedKeys = new Set<string>();

  return legs.map((leg, position) => {
    const key = requireNonEmpty(leg.key, 'Override key');
    if (usedKeys.has(key)) {
      throw new TransactionWorkflowError(`Duplicate override key ${key}`, 422);
    }
    usedKeys.add(key);

    const debitId = requireNonEmpty(
      leg.debitAccountDocumentId,
      'debit account',
    );
    const creditId = requireNonEmpty(
      leg.creditAccountDocumentId,
      'credit account',
    );
    if (debitId === creditId) {
      throw new TransactionWorkflowError(
        'Debit and credit accounts must differ',
        422,
      );
    }

    if (!accounts.has(debitId) || !accounts.has(creditId)) {
      throw new TransactionWorkflowError(
        'Unknown account on override leg',
        422,
      );
    }

    const currencyId = requireNonEmpty(
      leg.currencyTypeDocumentId,
      'currency_type',
    );
    if (!currencies.has(currencyId)) {
      throw new TransactionWorkflowError(
        'Unknown currency on override leg',
        422,
      );
    }

    if (!allowKorTreasury && legTouchesKorTreasury(leg, accounts, currencies)) {
      throw new TransactionWorkflowError(
        'KOR treasury account 1100 is not allowed on this conversion',
        422,
      );
    }

    let amount = Number(leg.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new TransactionWorkflowError(
        'Override leg amount must be positive',
        422,
      );
    }
    amount = roundLegAmount(amount, currencyId, currencies);

    if (leg.percent != null) {
      const expected = roundLegAmount(
        stepAmount(sourceAmount, leg.percent),
        currencyId,
        currencies,
      );
      if (Math.abs(expected - amount) > 0.0001) {
        throw new TransactionWorkflowError(
          'Override amount does not match percent of source amount',
          422,
        );
      }
    }

    const baselineRow =
      leg.sourceStepIndex != null
        ? baselineByIndex.get(leg.sourceStepIndex)
        : undefined;

    const enteredKey = baselineRow
      ? baselineRow.entered_key
      : customLegEnteredKey(transaction.documentId, key);

    const orgId = leg.organizationDocumentId?.trim() || null;
    const txnType = leg.transactionTypeDocumentId?.trim() || null;

    const debit: AccountRef = {
      documentId: debitId,
      code: accounts.get(debitId)?.code,
    };
    const credit: AccountRef = {
      documentId: creditId,
      code: accounts.get(creditId)?.code,
    };

    return {
      index: baselineRow?.index ?? position,
      legDate: leg.date?.trim() || undefined,
      description: noteCustomisedDescription(
        (leg.description ?? baselineRow?.description ?? '').trim(),
      ),
      amount,
      debit_account: debit,
      credit_account: credit,
      currency_type: { documentId: currencyId },
      transaction_type: txnType ? { documentId: txnType } : null,
      organization: orgId ? { documentId: orgId } : null,
      copy_receipt: leg.copyReceipt === true,
      entered_key: enteredKey,
      appliedRate: baselineRow?.appliedRate ?? null,
      memberRatio: baselineRow?.memberRatio ?? null,
    };
  });
}

export { ERROR_TRANSACTION_ALREADY_CONVERTED };
