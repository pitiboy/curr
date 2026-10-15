import { required } from 'react-admin';

import { receiptCardInvalid } from '../../data/receiptDraft';

const requiredField = required();

/** Required on draft create (`dataentry` űrlap) and on every HTTP draft write. */
export const TRANSACTION_DRAFT_REQUIRED = [
  'date',
  'amount',
  'currency_type',
  'description',
] as const;

/** Required before publish (`editor` Véglegesít). */
export const TRANSACTION_PUBLISH_REQUIRED = [
  'date',
  'amount',
  'currency_type',
  'description',
  'organization',
  'debit_account',
  'credit_account',
] as const;

/** @deprecated Use {@link TRANSACTION_DRAFT_REQUIRED} or {@link TRANSACTION_PUBLISH_REQUIRED}. */
export const TRANSACTION_FORM_REQUIRED = TRANSACTION_PUBLISH_REQUIRED;

type ReceiptCard = {
  file: File | null;
  vendor: string;
  receiptTypeId: string;
};

function requiredErrors(
  values: Record<string, unknown>,
  sources: readonly string[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const source of sources) {
    if (source === 'description') {
      const text =
        typeof values.description === 'string' ? values.description.trim() : '';
      if (!text) {
        const error = requiredField(undefined, values);
        if (typeof error === 'string') errors.description = error;
      }
      continue;
    }
    const error = requiredField(values[source], values);
    if (typeof error === 'string') errors[source] = error;
  }
  return errors;
}

/**
 * SimpleForm `validate` is the react-hook-form resolver, so field-level
 * `validate={required()}` does not run. Those props only draw the asterisk.
 */
export function transactionFormErrors(
  values: Record<string, unknown>,
  receiptCards: ReceiptCard[],
  translate: (key: string) => string,
): Record<string, string> {
  const errors = requiredErrors(values, TRANSACTION_DRAFT_REQUIRED);

  if (receiptCards.some(receiptCardInvalid)) {
    errors.receipt_cards = translate('app.receipt_card_required');
  }
  return errors;
}

/** Editor Véglegesít: mind a hét tranzakciómező kitöltése kötelező. */
export function transactionPublishFormErrors(
  values: Record<string, unknown>,
  _translate: (key: string) => string,
): Record<string, string> {
  return requiredErrors(values, TRANSACTION_PUBLISH_REQUIRED);
}

function relationDefault(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const documentId = (value as { documentId?: string }).documentId;
  return typeof documentId === 'string' && documentId.trim()
    ? documentId.trim()
    : undefined;
}

/**
 * Flat form record for editor review: relation sources are documentId strings,
 * not populated objects from the show record (ReferenceInput would 500 on getMany).
 */
export function reviewFormRecord(record: {
  amount?: string | number | null;
  credit_account?: { documentId?: string } | null;
  currency_type?: { documentId?: string } | null;
  date?: string | null;
  debit_account?: { documentId?: string } | null;
  description?: string | null;
  documentId?: string;
  id?: string;
  organization?: { documentId?: string } | null;
}): Record<string, unknown> {
  return {
    id: record.id ?? record.documentId,
    ...reviewFormDefaults(record),
  };
}

/** Default values for the editor draft review form (empty stays empty). */
export function reviewFormDefaults(record: {
  amount?: string | number | null;
  credit_account?: { documentId?: string } | null;
  currency_type?: { documentId?: string } | null;
  date?: string | null;
  debit_account?: { documentId?: string } | null;
  description?: string | null;
  organization?: { documentId?: string } | null;
}): Record<string, unknown> {
  return {
    date: record.date ?? undefined,
    amount: record.amount ?? undefined,
    currency_type: relationDefault(record.currency_type),
    description:
      typeof record.description === 'string' ? record.description : '',
    organization: relationDefault(record.organization),
    debit_account: relationDefault(record.debit_account),
    credit_account: relationDefault(record.credit_account),
  };
}
