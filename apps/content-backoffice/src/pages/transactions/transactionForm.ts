import { required } from 'react-admin';

import { receiptCardInvalid } from '../../data/receiptDraft';

const requiredField = required();

/** Create: date, amount, currency and description. The three relations are optional. */
export const TRANSACTION_FORM_REQUIRED = [
  'date',
  'amount',
  'currency_type',
  'description',
] as const;

/** Review publish: the create four plus organization, debit and credit. */
export const TRANSACTION_PUBLISH_REQUIRED = [
  'date',
  'amount',
  'currency_type',
  'description',
  'organization',
  'debit_account',
  'credit_account',
] as const;

export type TransactionFormField = (typeof TRANSACTION_PUBLISH_REQUIRED)[number];

type ReceiptCard = {
  file: File | null;
  vendor: string;
  receiptTypeId: string;
};

/**
 * SimpleForm `validate` is the react-hook-form resolver, so field-level
 * `validate={required()}` does not run. Those props only draw the asterisk.
 */
export function transactionFormErrors(
  values: Record<string, unknown>,
  receiptCards: ReceiptCard[],
  translate: (key: string) => string,
  requiredFields: readonly TransactionFormField[] = TRANSACTION_FORM_REQUIRED,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const source of requiredFields) {
    const error = requiredField(formValue(source, values[source]), values);
    if (typeof error === 'string') errors[source] = error;
  }

  if (receiptCards.some(receiptCardInvalid)) {
    errors.receipt_cards = translate('app.receipt_card_required');
  }
  return errors;
}

/**
 * Form values for editor review. Empty relations stay empty: no placeholder id.
 */
export function transactionReviewValues(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return {
    date: record.date ?? '',
    amount: amountValue(record.amount),
    description:
      typeof record.description === 'string' ? record.description : '',
    currency_type: relationInputId(record.currency_type) ?? '',
    organization: relationInputId(record.organization) ?? '',
    debit_account: relationInputId(record.debit_account) ?? '',
    credit_account: relationInputId(record.credit_account) ?? '',
  };
}

export function relationInputId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (!value || typeof value !== 'object') return undefined;
  const documentId = (value as { documentId?: unknown }).documentId;
  return typeof documentId === 'string' && documentId.trim()
    ? documentId.trim()
    : undefined;
}

function formValue(source: string, value: unknown): unknown {
  if (source === 'description' && typeof value === 'string') return value.trim();
  return value;
}

function amountValue(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return '';
  return value;
}
