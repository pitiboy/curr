import { required } from 'react-admin';

import { receiptCardInvalid } from '../../data/receiptDraft';

const requiredField = required();

/** Same set the publish guard rejects when a transaction write omits them. */
export const TRANSACTION_FORM_REQUIRED = [
  'date',
  'amount',
  'currency_type',
  'organization',
  'debit_account',
  'credit_account',
] as const;

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
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const source of TRANSACTION_FORM_REQUIRED) {
    const error = requiredField(values[source], values);
    if (typeof error === 'string') errors[source] = error;
  }

  const description =
    typeof values.description === 'string' ? values.description.trim() : '';
  const hasFile = receiptCards.some((card) => card.file && card.file.size > 0);
  if (hasFile && !description) {
    errors.description = translate('app.receipt_description_required');
  }
  if (receiptCards.some(receiptCardInvalid)) {
    errors.receipt_cards = translate('app.receipt_card_required');
  }
  return errors;
}
